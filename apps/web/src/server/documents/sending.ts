import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { documents, type Document } from "@/server/db/schema";
import type { OrgContext } from "@/server/auth/context";
import { getDocument } from "@/server/documents/queries";
import { ensurePublicToken, shareUrl } from "@/server/documents/service";
import { prepareIssue } from "@/server/documents/tax-invoice";
import { renderDocumentPdf } from "@/server/pdf/render";
import { sendMail } from "@/server/email/transport";
import {
  buildDocumentEmail,
  defaultSubject,
  interpolate,
  NOTE_EMAIL_TEMPLATES,
  templateVars,
} from "@/server/email/templates";
import { getEmailTemplate } from "@/server/email/template-store";
import { incrementUsage } from "@/server/billing/usage";
import { logActivity } from "@/server/activity";
import { uploadPrivateFile } from "@/server/storage";
import { fail, ok, type ServiceResult } from "@/server/service-result";
import { viewFromStored } from "@/lib/document-view";
import { rateLimit } from "@/lib/rate-limit";

export interface SendInput {
  to?: string;
  subject?: string;
  message?: string;
}

/**
 * Email a document as a PDF attachment with a link to its online view, then
 * mark it sent. Shared by the web send dialog and `/api/v1`.
 */
export async function sendDocumentForOrg(
  ctx: OrgContext,
  id: string,
  input: SendInput
): Promise<ServiceResult<{ recipient: string; type: Document["type"] }>> {
  const rl = rateLimit(`send:${ctx.org.id}`, 20, 60_000);
  if (!rl.ok) {
    return fail("rate_limited", "Too many emails sent just now. Please wait a moment.");
  }

  const full = await getDocument(ctx.org.id, id);
  if (!full) return fail("not_found", "Document not found.");

  // Emailing a draft issues it: SARS checks, and the PDF shows frozen details.
  const prepared = await prepareIssue(ctx, full.document);
  if (!prepared.ok) return prepared;
  full.document = prepared.data;

  const recipient =
    input.to?.trim() ||
    full.client?.email ||
    (typeof full.document.billToSnapshot?.email === "string"
      ? (full.document.billToSnapshot.email as string)
      : undefined);

  if (!recipient) {
    return fail(
      "validation",
      "No recipient email. Add an email to the client or enter one.",
      { to: ["Recipient email is required"] }
    );
  }

  const view = viewFromStored(full.document, full.items, {
    showPoweredBy: !ctx.plan.features.customBranding,
    related: full.related,
  });
  const businessName = ctx.profile?.displayName ?? ctx.org.name;

  // Resolve the org's (possibly customized) template for this document type and
  // interpolate variables. A user-supplied subject/message overrides it.
  const docType = full.document.type;
  const template =
    docType === "credit_note" || docType === "debit_note"
      ? NOTE_EMAIL_TEMPLATES[docType]
      : await getEmailTemplate(ctx.org.id, docType);
  const vars = templateVars(view, businessName, full.client?.name);
  const subject =
    input.subject?.trim() ||
    interpolate(template.subject, vars) ||
    defaultSubject(view, businessName);
  const message = input.message?.trim() || interpolate(template.body, vars);

  // Ensure a public share token exists so the email can link to an online view.
  const publicToken = await ensurePublicToken(ctx.org.id, id);
  if (!publicToken) return fail("not_found", "Document not found.");
  const viewUrl = shareUrl(publicToken);

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

  if (!result.ok) return fail("upstream", result.error ?? "Email could not be sent.");

  // Mark sent (advance from draft) and record timestamps.
  await db
    .update(documents)
    .set({
      status: full.document.status === "draft" ? "sent" : full.document.status,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id)));

  await incrementUsage(ctx.org.id, "emailsSent");

  // Best-effort: archive the sent PDF to private storage when configured.
  // One object per send, so an edited-and-resent document keeps each version.
  try {
    const key = await uploadPrivateFile(
      `pdfs/${ctx.org.id}/${id}/${Date.now()}.pdf`,
      pdf,
      "application/pdf"
    );
    if (key) {
      await db
        .update(documents)
        .set({ pdfKey: key })
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

  return ok({ recipient, type: full.document.type });
}
