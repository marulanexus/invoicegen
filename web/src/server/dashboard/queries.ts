import "server-only";

import { and, count, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { addDays, subMonths, subQuarters } from "date-fns";

import { db } from "@/server/db";
import { clients, documents, payments } from "@/server/db/schema";

export interface DashboardMetrics {
  totalRevenue: number;
  outstanding: number;
  overdue: number;
  activeClients: number;
}

export async function getDashboardMetrics(
  orgId: string
): Promise<DashboardMetrics> {
  const today = new Date().toISOString().slice(0, 10);

  const [[revenue], [outstandingRow], [overdueRow], [clientRow]] = await Promise.all([
    db
      .select({ value: sql<string>`coalesce(sum(${payments.amount}), 0)` })
      .from(payments)
      .where(eq(payments.orgId, orgId)),
    db
      .select({
        value: sql<string>`coalesce(sum(${documents.total} - ${documents.amountPaid}), 0)`,
      })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          eq(documents.type, "invoice"),
          sql`${documents.status} in ('sent','viewed','partial','overdue')`
        )
      ),
    db
      .select({
        value: sql<string>`coalesce(sum(${documents.total} - ${documents.amountPaid}), 0)`,
      })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, orgId),
          eq(documents.type, "invoice"),
          sql`${documents.status} in ('sent','viewed','partial','overdue')`,
          lt(documents.dueDate, today)
        )
      ),
    db
      .select({ value: count() })
      .from(clients)
      .where(and(eq(clients.orgId, orgId), eq(clients.status, "active"))),
  ]);

  return {
    totalRevenue: Number(revenue?.value ?? 0),
    outstanding: Number(outstandingRow?.value ?? 0),
    overdue: Number(overdueRow?.value ?? 0),
    activeClients: clientRow?.value ?? 0,
  };
}

export interface RevenuePoint {
  month: string; // e.g. "Jan"
  revenue: number;
}

/** Revenue (received payments) for the last `months` months. */
export async function getRevenueSeries(
  orgId: string,
  months = 6
): Promise<RevenuePoint[]> {
  const since = subMonths(new Date(), months - 1);
  since.setDate(1);

  const rows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('month', ${payments.paidAt}), 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(and(eq(payments.orgId, orgId), gte(payments.paidAt, since)))
    .groupBy(sql`date_trunc('month', ${payments.paidAt})`);

  const map = new Map(rows.map((r) => [r.bucket, Number(r.total)]));
  const series: RevenuePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    series.push({
      month: d.toLocaleString("en", { month: "short" }),
      revenue: map.get(key) ?? 0,
    });
  }
  return series;
}

/** Revenue grouped by quarter for the last `quarters` quarters. */
export async function getRevenueSeriesQuarterly(
  orgId: string,
  quarters = 4
): Promise<RevenuePoint[]> {
  const since = subQuarters(new Date(), quarters - 1);

  const rows = await db
    .select({
      bucket: sql<string>`to_char(date_trunc('quarter', ${payments.paidAt}), 'YYYY-Q')`,
      total: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(and(eq(payments.orgId, orgId), gte(payments.paidAt, since)))
    .groupBy(sql`date_trunc('quarter', ${payments.paidAt})`);

  const map = new Map(rows.map((r) => [r.bucket, Number(r.total)]));
  const series: RevenuePoint[] = [];
  for (let i = quarters - 1; i >= 0; i--) {
    const d = subQuarters(new Date(), i);
    const q = Math.floor(d.getMonth() / 3) + 1;
    const key = `${d.getFullYear()}-${q}`;
    series.push({ month: `Q${q} ${d.getFullYear()}`, revenue: map.get(key) ?? 0 });
  }
  return series;
}

export interface ReminderItem {
  id: string;
  number: string;
  clientName: string | null;
  dueDate: string | null;
  balance: number;
  currency: string;
  overdue: boolean;
}

/** Invoices due in the next 7 days or already overdue (for the dashboard). */
export async function getUpcomingReminders(
  orgId: string
): Promise<ReminderItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = addDays(new Date(), 7).toISOString().slice(0, 10);

  const rows = await db
    .select({
      id: documents.id,
      number: documents.number,
      clientName: clients.name,
      dueDate: documents.dueDate,
      total: documents.total,
      amountPaid: documents.amountPaid,
      currency: documents.currency,
    })
    .from(documents)
    .leftJoin(clients, eq(documents.clientId, clients.id))
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.type, "invoice"),
        sql`${documents.status} in ('sent','viewed','partial','overdue')`,
        lte(documents.dueDate, horizon)
      )
    )
    .orderBy(documents.dueDate)
    .limit(8);

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    clientName: r.clientName,
    dueDate: r.dueDate,
    balance: Number(r.total) - Number(r.amountPaid),
    currency: r.currency,
    overdue: !!r.dueDate && r.dueDate < today,
  }));
}

export interface PaymentRow {
  id: string;
  amount: string;
  currency: string;
  method: string;
  paidAt: Date;
  reference: string | null;
  documentId: string;
  documentNumber: string | null;
  clientName: string | null;
}

export async function listPayments(
  orgId: string,
  limit?: number
): Promise<PaymentRow[]> {
  const q = db
    .select({
      id: payments.id,
      amount: payments.amount,
      currency: payments.currency,
      method: payments.method,
      paidAt: payments.paidAt,
      reference: payments.reference,
      documentId: payments.documentId,
      documentNumber: documents.number,
      clientName: clients.name,
    })
    .from(payments)
    .leftJoin(documents, eq(payments.documentId, documents.id))
    .leftJoin(clients, eq(payments.clientId, clients.id))
    .where(eq(payments.orgId, orgId))
    .orderBy(desc(payments.paidAt));

  return limit ? q.limit(limit) : q;
}
