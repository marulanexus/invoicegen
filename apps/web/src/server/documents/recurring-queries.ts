import "server-only";

import { addDays, addMonths, addWeeks, addYears, format } from "date-fns";
import { and, eq, lte } from "drizzle-orm";

import { db } from "@/server/db";
import {
  businessProfiles,
  clients,
  documents,
  lineItems,
  recurringInvoices,
  type RecurringInvoice,
} from "@/server/db/schema";
import { reserveDocumentNumber } from "@/server/documents/numbering";
import { calcDocumentTotals } from "@/lib/calc";
import { toMoneyString } from "@/lib/money";
import type { RecurringPayload } from "@/server/documents/recurring-actions";

export type RecurringWithClient = RecurringInvoice & { clientName: string | null };

export async function listRecurring(
  orgId: string
): Promise<RecurringWithClient[]> {
  const rows = await db
    .select({ rec: recurringInvoices, clientName: clients.name })
    .from(recurringInvoices)
    .leftJoin(clients, eq(recurringInvoices.clientId, clients.id))
    .where(eq(recurringInvoices.orgId, orgId))
    .orderBy(recurringInvoices.nextRunDate);
  return rows.map((r) => ({ ...r.rec, clientName: r.clientName }));
}

function advance(
  date: Date,
  frequency: RecurringInvoice["frequency"],
  interval: number
): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(date, interval);
    case "monthly":
      return addMonths(date, interval);
    case "quarterly":
      return addMonths(date, interval * 3);
    case "yearly":
      return addYears(date, interval);
  }
}

/**
 * Generate invoices for every active schedule whose next run date has arrived.
 * Catches up multiple missed cycles in one pass. Returns how many were created.
 * Intended to be called from the daily cron.
 */
export async function runDueRecurring(orgId?: string): Promise<number> {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const conditions = [
    eq(recurringInvoices.active, true),
    lte(recurringInvoices.nextRunDate, todayStr),
  ];
  if (orgId) conditions.push(eq(recurringInvoices.orgId, orgId));

  const due = await db
    .select()
    .from(recurringInvoices)
    .where(and(...conditions));

  let created = 0;

  for (const schedule of due) {
    const payload = schedule.payload as unknown as RecurringPayload;

    const [profile] = await db
      .select()
      .from(businessProfiles)
      .where(eq(businessProfiles.orgId, schedule.orgId))
      .limit(1);
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, schedule.clientId))
      .limit(1);

    let nextRun = new Date(schedule.nextRunDate);
    const end = schedule.endDate ? new Date(schedule.endDate) : null;
    // Defense-in-depth: never let a bad interval stall advancement.
    const interval = Math.max(1, schedule.interval);

    // Catch up each missed cycle (guard against runaway loops).
    let guard = 0;
    while (nextRun <= today && (!end || nextRun <= end) && guard < 60) {
      guard++;
      const issueDate = format(nextRun, "yyyy-MM-dd");
      const dueDate = format(
        addDays(nextRun, payload.paymentTermsDays ?? 14),
        "yyyy-MM-dd"
      );
      const totals = calcDocumentTotals(payload.lineItems, payload.taxInclusive);

      await db.transaction(async (tx) => {
        const number = await reserveDocumentNumber(tx, schedule.orgId, "invoice");
        const [inv] = await tx
          .insert(documents)
          .values({
            orgId: schedule.orgId,
            clientId: schedule.clientId,
            type: "invoice",
            number,
            status: "draft",
            currency: payload.currency,
            issueDate,
            dueDate,
            poNumber: payload.poNumber,
            templateKey: payload.templateKey,
            accentColor: payload.accentColor,
            taxLabel: payload.taxLabel,
            taxInclusive: payload.taxInclusive,
            notes: payload.notes,
            terms: payload.terms,
            subtotal: toMoneyString(totals.subtotal),
            discountTotal: toMoneyString(totals.discountTotal),
            taxTotal: toMoneyString(totals.taxTotal),
            total: toMoneyString(totals.total),
            fromSnapshot: profile
              ? {
                  name: profile.displayName,
                  email: profile.email,
                  address: [
                    profile.addressLine1,
                    profile.addressLine2,
                    [profile.city, profile.state].filter(Boolean).join(", "),
                    profile.postalCode,
                    profile.country,
                  ].filter(Boolean),
                  taxId: profile.taxId,
                  logoUrl: profile.logoUrl,
                }
              : undefined,
            billToSnapshot: client
              ? {
                  name: client.name,
                  company: client.companyName,
                  email: client.email,
                  address: [
                    client.addressLine1,
                    client.addressLine2,
                    [client.city, client.state].filter(Boolean).join(", "),
                    client.postalCode,
                    client.country,
                  ].filter(Boolean),
                }
              : undefined,
          })
          .returning();

        if (payload.lineItems.length) {
          await tx.insert(lineItems).values(
            payload.lineItems.map((li, idx) => {
              const net =
                Number(li.quantity) *
                Number(li.unitPrice) *
                (1 - Number(li.discountRate) / 100);
              return {
                documentId: inv.id,
                position: idx,
                description: li.description,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                discountRate: li.discountRate,
                taxRate: li.taxRate,
                amount: toMoneyString(net),
              };
            })
          );
        }
      });

      created++;
      nextRun = advance(nextRun, schedule.frequency, interval);

      // Persist progress AFTER each committed cycle so a mid-loop crash never
      // re-generates already-created invoices on the next cron run.
      await db
        .update(recurringInvoices)
        .set({ nextRunDate: format(nextRun, "yyyy-MM-dd"), lastRunAt: new Date() })
        .where(eq(recurringInvoices.id, schedule.id));
    }

    // Deactivate once the schedule has run past its end date.
    if (end && nextRun > end) {
      await db
        .update(recurringInvoices)
        .set({ active: false })
        .where(eq(recurringInvoices.id, schedule.id));
    }
  }

  return created;
}
