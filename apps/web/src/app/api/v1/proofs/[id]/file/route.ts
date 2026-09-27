import { apiError, apiResult, isUuid, withApiAuth } from "@/server/api/http";
import { proofFileUrlForOrg } from "@/server/proofs/service";

/** `{ url }`: a 5-minute link to view the uploaded proof. */
export const GET = withApiAuth<{ id: string }>(async (ctx, _req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Proof not found.");
  return apiResult(await proofFileUrlForOrg(ctx, id));
});
