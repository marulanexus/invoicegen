import { apiError, apiResult, isUuid, withApiAuth } from "@/server/api/http";
import { getShareLinkForOrg } from "@/server/documents/service";

/** `{ url }` of the public online view, for sharing by WhatsApp or SMS. */
export const POST = withApiAuth<{ id: string }>(async (ctx, _req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Document not found.");
  return apiResult(await getShareLinkForOrg(ctx, id));
});
