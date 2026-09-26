import { apiError, apiResult, isUuid, withApiAuth } from "@/server/api/http";
import { setClientStatusForOrg } from "@/server/clients/service";

export const POST = withApiAuth<{ id: string }>(async (ctx, _req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Client not found.");
  return apiResult(await setClientStatusForOrg(ctx, id, "active"));
});
