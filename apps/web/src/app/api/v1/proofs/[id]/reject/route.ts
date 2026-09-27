import { apiError, apiResult, isUuid, readJson, withApiAuth } from "@/server/api/http";
import { rejectProofForOrg } from "@/server/proofs/service";

/** Reject a proof of payment: `{ reason }`. */
export const POST = withApiAuth<{ id: string }>(async (ctx, req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Proof not found.");
  const body = await readJson(req);
  if (body === undefined) return apiError(400, "bad_request", "Expected a JSON body.");
  return apiResult(await rejectProofForOrg(ctx, id, body));
});
