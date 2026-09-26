"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { documents } from "@/server/db/schema";
import { env } from "@/lib/env";
import { requireOrgContext } from "@/server/auth/context";
import { getDocument } from "@/server/documents/queries";
import { renderDocumentPdf } from "@/server/pdf/render";
import { sendMail } from "@/server/email/transport";
import {
  buildDocumentEmail,
  defaultSubject,
  interpolate,
  templateVars,
} from "@/server/email/templates";
import { getEmailTemplate } from "@/server/email/template-store";
import { incrementUsage } from "@/server/billing/usage";
import { logActivity } from "@/server/activity";
import { uploadFile } from "@/server/storage";
import { viewFromStored } from "@/lib/document-view";
import { rateLimit } from "@/lib/rate-limit";

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendDocument(
  id: string,
  input: { to?: string; subject?: string; message?: string }
): Promise<SendResult> {
  const ctx = await requireOrgContext();

  const rl = rateLimit(`send:${ctx.org.id}`, 20, 60_000);
  if (!rl.ok) {
    return { ok: false, error: "Too many emails sent just now. Please wait a moment." };
  }

  const full = await getDocument(ctx.org.id, id);
  if (!full) return { ok: false, error: "Document not found." };

  const recipient =
    input.to?.trim() ||
    full.client?.email ||
    (typeof full.document.billToSnapshot?.email === "string"
      ? (full.document.billToSnapshot.email as string)
      : undefined);

  if (!recipient) {
    return {
      ok: false,
      error: "No recipient email. Add an email to the client or enter one.",
    };
  }

  const view = viewFromStored(full.document, full.items, {
    showPoweredBy: !ctx.plan.features.customBranding,
  });
  const businessName = ctx.profile?.displayName ?? ctx.org.name;

  // Resolve the org's (possibly customized) template for this document type and
  // interpolate variables. A user-supplied subject/message overrides it.
  const template = await getEmailTemplate(ctx.org.id, full.document.type);
  const vars = templateVars(view, businessName, full.client?.name);
  const subject =
    input.subject?.trim() ||
    interpolate(template.subject, vars) ||
    defaultSubject(view, businessName);
  const message = input.message?.trim() || interpolate(template.body, vars);

  // Ensure a public share token exists so the email can link to an online view.
  const publicToken = full.document.publicToken ?? randomBytes(16).toString("hex");
  const viewUrl = `${env.APP_URL}/p/${publicToken}`;

  const pdf = await renderDocumentPdf(view);
  const html = buildDocumentEmail({ view, businessName, message, viewUrl });

  const result = await sendMail({
    orgId: ctx.org.id,
    to: recipient,
    subject,
    html,
    attachments: [
      {
        filename: `${full.document.number}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  });

  if (!result.ok) return { ok: false, error: result.error };

  // Mark sent (advance from draft), persist the share token, record timestamps.
  await db
    .update(documents)
    .set({
      status: full.document.status === "draft" ? "sent" : full.document.status,
      sentAt: new Date(),
      publicToken,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id)));

  await incrementUsage(ctx.org.id, "emailsSent");

  // Best-effort: archive the sent PDF to blob storage when configured.
  try {
    const stored = await uploadFile(
      `pdfs/${ctx.org.id}/${full.document.number}.pdf`,
      pdf,
      "application/pdf"
    );
    if (stored) {
      await db
        .update(documents)
        .set({ pdfUrl: stored })
        .where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id)));
    }
  } catch (err) {
    console.error("[send] PDF archive failed", err);
  }

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: `${full.document.type}.sent`,
    entityType: "document",
    entityId: id,
    description: `Emailed ${full.document.number} to ${recipient}`,
  });

  revalidatePath(`/documents/${id}`);
  revalidatePath(`/${full.document.type}s`);
  return { ok: true };
}
