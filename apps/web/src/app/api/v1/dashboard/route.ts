import { z } from "zod";

import { apiData, apiError, withApiAuth } from "@/server/api/http";
import {
  getDashboardMetrics,
  getRevenueSeries,
  getRevenueSeriesQuarterly,
  getUpcomingReminders,
  listPayments,
} from "@/server/dashboard/queries";
import { listDocuments } from "@/server/documents/queries";

const query = z.object({
  period: z.enum(["monthly", "quarterly"]).default("monthly"),
});

/**
 * Everything the phone's home screen needs in one round trip: headline
 * totals, revenue chart, invoices due soon or overdue, and recent activity.
 * Amounts are numbers in the business's currency. `?period=monthly|quarterly`
 */
export const GET = withApiAuth(async (ctx, req) => {
  const q = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return apiError(400, "bad_request", "Invalid query parameters.");
  const orgId = ctx.org.id;

  const [metrics, revenue, dueSoon, recentPayments, recentDocuments] = await Promise.all([
    getDashboardMetrics(orgId),
    q.data.period === "quarterly" ? getRevenueSeriesQuarterly(orgId) : getRevenueSeries(orgId),
    getUpcomingReminders(orgId),
    listPayments(orgId, 5),
    listDocuments(orgId, { limit: 5 }),
  ]);

  return apiData({
    currency: ctx.profile?.defaultCurrency ?? null,
    metrics,
    revenue: { period: q.data.period, points: revenue },
    dueSoon,
    recentPayments,
    recentDocuments: recentDocuments.map((d) => ({
      id: d.id,
      type: d.type,
      number: d.number,
      status: d.status,
      clientName: d.clientName,
      issueDate: d.issueDate,
      dueDate: d.dueDate,
      total: d.total,
      amountPaid: d.amountPaid,
      currency: d.currency,
    })),
  });
});
