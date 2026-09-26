import { z } from "zod";

import { apiData, apiError, apiResult, readJson, withApiAuth } from "@/server/api/http";
import { listPayments } from "@/server/dashboard/queries";
import { recordPaymentForOrg } from "@/server/payments/service";

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Most recent payments first, with invoice number and client name. `?limit=50` */
export const GET = withApiAuth(async (ctx, req) => {
  const q = listQuery.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return apiError(400, "bad_request", "Invalid query parameters.");
  return apiData(await listPayments(ctx.org.id, q.data.limit));
});

/**
 * Record a payment against an invoice:
 * `{ documentId, amount, method, paidAt, reference?, notes? }`.
 * Returns the payment and the updated invoice (status becomes partial/paid).
 * 422 if the amount exceeds the balance; 409 for quotes, void or paid invoices.
 */
export const POST = withApiAuth(async (ctx, req) => {
  const body = await readJson(req);
  if (body === undefined) return apiError(400, "bad_request", "Expected a JSON body.");
  return apiResult(await recordPaymentForOrg(ctx, body), 201);
});
