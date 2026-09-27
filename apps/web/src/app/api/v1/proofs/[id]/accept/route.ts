import { apiError, apiResult, isUuid, readJson, withApiAuth } from "@/server/api/http";
import { acceptProofForOrg } from "@/server/proofs/service";

/**
 * Accept a proof of payment and record the payment:
 * `{ amount, paidAt: "YYYY-MM-DD", method?: "bank_transfer" | "cash" | "card" | "other", reference? }`.
 */
export const POST = withApiAuth<{ id: string }>(async (ctx, req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Proof not found.");
  const body = await readJson(req);
  if (body === undefined) return apiError(400, "bad_request", "Expected a JSON body.");
  return apiResult(await acceptProofForOrg(ctx, id, body));
});
