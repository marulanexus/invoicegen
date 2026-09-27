import { apiError, apiResult, isUuid, readJson, withApiAuth } from "@/server/api/http";
import { recordRefundForOrg } from "@/server/payments/service";

/**
 * Record money paid back to the client: `{ amount, method, paidAt, reference?, notes? }`.
 * Up to what was overpaid (e.g. after a credit note), or everything paid on a
 * void invoice. Returns the refund and the updated invoice; 422 if the amount
 * is more than the refund due, 409 when nothing is refundable.
 */
export const POST = withApiAuth<{ id: string }>(async (ctx, req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Invoice not found.");
  const body = await readJson(req);
  if (body === undefined || body === null || typeof body !== "object") {
    return apiError(400, "bad_request", "Expected a JSON body.");
  }
  return apiResult(await recordRefundForOrg(ctx, { ...body, documentId: id }), 201);
});
