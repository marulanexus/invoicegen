import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";

import { db } from "@/server/db";
import { clients, documents } from "@/server/db/schema";

export interface RevenueByClientRow {
  clientId: string | null;
  clientName: string | null;
  invoiced: number;
  paid: number;
}

/**
 * Top 10 clients by amount invoiced. Counts only "real" invoices
 * (excludes drafts and voided documents).
 */
export async function revenueByClient(
  orgId: string
): Promise<RevenueByClientRow[]> {
  const rows = await db
    .select({
      clientId: documents.clientId,
      clientName: clients.name,
      invoiced: sql<string>`coalesce(sum(${documents.total}), 0)`,
      paid: sql<string>`coalesce(sum(${documents.amountPaid}), 0)`,
    })
    .from(documents)
    .leftJoin(clients, eq(documents.clientId, clients.id))
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.type, "invoice"),
        sql`${documents.status} != 'void'`,
        sql`${documents.status} != 'draft'`
      )
    )
    .groupBy(documents.clientId, clients.name)
    .orderBy(desc(sql`coalesce(sum(${documents.total}), 0)`))
    .limit(10);

  return rows.map((r) => ({
    clientId: r.clientId,
    clientName: r.clientName,
    invoiced: Number(r.invoiced),
    paid: Number(r.paid),
  }));
}

export interface RevenueByStatusRow {
  status: string;
  count: number;
  total: number;
}

/** Invoice counts and totals grouped by status. */
export async function revenueByStatus(
  orgId: string
): Promise<RevenueByStatusRow[]> {
  const rows = await db
    .select({
      status: documents.status,
      count: sql<number>`count(*)`,
      total: sql<string>`coalesce(sum(${documents.total}), 0)`,
    })
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.type, "invoice")))
    .groupBy(documents.status)
    .orderBy(desc(sql`coalesce(sum(${documents.total}), 0)`));

  return rows.map((r) => ({
    status: r.status,
    count: Number(r.count),
    total: Number(r.total),
  }));
}

export interface InvoiceAgingRow {
  bucket: string;
  total: number;
}

const AGING_BUCKETS = ["Current", "1–30 days", "31–60 days", "60+ days"] as const;

/**
 * Accounts-receivable aging. Buckets the outstanding balance of open invoices
 * by how many days they are past their due date (relative to today).
 */
export async function invoiceAging(orgId: string): Promise<InvoiceAgingRow[]> {
  const rows = await db
    .select({
      id: documents.id,
      total: documents.total,
      amountPaid: documents.amountPaid,
      dueDate: documents.dueDate,
    })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.type, "invoice"),
        sql`${documents.status} in ('sent','viewed','partial','overdue')`
      )
    );

  const totals: Record<(typeof AGING_BUCKETS)[number], number> = {
    Current: 0,
    "1–30 days": 0,
    "31–60 days": 0,
    "60+ days": 0,
  };

  const today = new Date();

  for (const row of rows) {
    const outstanding = Number(row.total) - Number(row.amountPaid);
    if (outstanding <= 0) continue;

    // No due date or due in the future → not yet overdue.
    const daysPastDue = row.dueDate
      ? differenceInCalendarDays(today, new Date(row.dueDate))
      : 0;

    let bucket: (typeof AGING_BUCKETS)[number];
    if (daysPastDue <= 0) bucket = "Current";
    else if (daysPastDue <= 30) bucket = "1–30 days";
    else if (daysPastDue <= 60) bucket = "31–60 days";
    else bucket = "60+ days";

    totals[bucket] += outstanding;
  }

  return AGING_BUCKETS.map((bucket) => ({ bucket, total: totals[bucket] }));
}
