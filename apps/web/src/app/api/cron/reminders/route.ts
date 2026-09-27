import { NextResponse } from "next/server";
import { amountOwed } from "@invoicegen/shared/calc";
import { and, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";

import { db } from "@/server/db";
import {
  documents,
  reminderLog,
  reminderSettings,
} from "@/server/db/schema";
import { getPlan } from "@/lib/plans";
import { env } from "@/lib/env";
import { notifyOverdue } from "@/server/notifications/events";

export const runtime = "nodejs";

/**
 * Scheduled job (configure in vercel.json or any cron service):
 *   1. Flags open invoices past their due date as `overdue`.
 *   2. Sends reminder emails per each org's configured offset schedule,
 *      de-duplicated via `reminder_log`.
 *
 * Protect with the CRON_SECRET bearer token.
 */
export async function GET(req: Request) {
  // Fail closed in production: a missing CRON_SECRET must not leave the job open.
  if (!env.CRON_SECRET) {
    if (env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 401 }
      );
    }
  } else {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  // 0. Generate due recurring invoices.
  const { runDueRecurring } = await import("@/server/documents/recurring-queries");
  const recurringCreated = await runDueRecurring();

  // 1. Mark overdue.
  const overdue = await db
    .update(documents)
    .set({ status: "overdue", updatedAt: new Date() })
    .where(
      and(
        eq(documents.type, "invoice"),
        inArray(documents.status, ["sent", "viewed", "partial"]),
        isNotNull(documents.dueDate),
        lt(documents.dueDate, today)
      )
    )
    .returning({
      id: documents.id,
      orgId: documents.orgId,
      number: documents.number,
      total: documents.total,
      amountPaid: documents.amountPaid,
      adjustmentTotal: documents.adjustmentTotal,
      currency: documents.currency,
      billTo: documents.billToSnapshot,
    });

  // Tell each business about invoices that just became overdue (one push per org).
  const overdueByOrg = new Map<string, typeof overdue>();
  for (const inv of overdue) overdueByOrg.set(inv.orgId, [...(overdueByOrg.get(inv.orgId) ?? []), inv]);
  for (const [orgId, invoices] of overdueByOrg) {
    notifyOverdue(
      orgId,
      invoices.map((i) => ({
        documentId: i.id,
        number: i.number,
        balance: amountOwed(i),
        currency: i.currency,
        clientName: typeof i.billTo?.name === "string" ? (i.billTo.name as string) : null,
      }))
    );
  }

  // 2. Reminder pass (only for orgs that enabled it + have the plan feature).
  const settings = await db
    .select()
    .from(reminderSettings)
    .where(eq(reminderSettings.enabled, true));

  let remindersSent = 0;
  const { sendMail } = await import("@/server/email/transport");
  const { renderDocumentPdf } = await import("@/server/pdf/render");
  const { getDocument } = await import("@/server/documents/queries");
  const { viewFromStored } = await import("@/lib/document-view");
  const { buildDocumentEmail } = await import("@/server/email/templates");
  const { organizations } = await import("@/server/db/schema");

  for (const setting of settings) {
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, setting.orgId))
      .limit(1);
    if (!org || !getPlan(org.plan).features.automatedReminders) continue;

    const openInvoices = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.orgId, setting.orgId),
          eq(documents.type, "invoice"),
          inArray(documents.status, ["sent", "viewed", "partial", "overdue"]),
          isNotNull(documents.dueDate)
        )
      );

    for (const inv of openInvoices) {
      const due = inv.dueDate ? new Date(inv.dueDate) : null;
      if (!due) continue;
      // offset = days relative to due date (negative before, positive after)
      const offset = differenceInCalendarDays(new Date(), due);
      if (!setting.schedule.includes(offset)) continue;

      // Skip if we already logged this offset for this invoice.
      const [already] = await db
        .select({ id: reminderLog.id })
        .from(reminderLog)
        .where(
          and(
            eq(reminderLog.documentId, inv.id),
            eq(reminderLog.offsetDays, offset)
          )
        )
        .limit(1);
      if (already) continue;

      const full = await getDocument(setting.orgId, inv.id);
      const recipient =
        full?.client?.email ??
        (typeof inv.billToSnapshot?.email === "string"
          ? (inv.billToSnapshot.email as string)
          : null);
      if (!full || !recipient) continue;

      const view = viewFromStored(full.document, full.items, {
        showPoweredBy: !getPlan(org.plan).features.customBranding,
        related: full.related,
      });
      const pdf = await renderDocumentPdf(view);
      const html = buildDocumentEmail({
        view,
        businessName: view.from.name,
        message:
          offset <= 0
            ? `This is a friendly reminder that invoice ${inv.number} is due soon.`
            : `Invoice ${inv.number} is now ${offset} day(s) overdue. Please arrange payment at your earliest convenience.`,
      });

      const res = await sendMail({
        orgId: setting.orgId,
        to: recipient,
        subject: `Reminder: invoice ${inv.number}`,
        html,
        attachments: [
          { filename: `${inv.number}.pdf`, content: pdf, contentType: "application/pdf" },
        ],
      });

      if (res.ok) {
        await db.insert(reminderLog).values({
          documentId: inv.id,
          offsetDays: offset,
        });
        remindersSent++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    recurringCreated,
    markedOverdue: overdue.length,
    remindersSent,
    ranAt: new Date().toISOString(),
  });
}
