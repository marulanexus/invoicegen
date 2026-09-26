import { apiData, apiError, apiResult, isUuid, readJson, withApiAuth } from "@/server/api/http";
import { getClient } from "@/server/clients/queries";
import { updateClientForOrg } from "@/server/clients/service";

type Params = { id: string };

const notFound = () => apiError(404, "not_found", "Client not found.");

export const GET = withApiAuth<Params>(async (ctx, _req, { id }) => {
  if (!isUuid(id)) return notFound();
  const client = await getClient(ctx.org.id, id);
  return client ? apiData(client) : notFound();
});

/** Replace the client's details (same fields as create). */
export const PUT = withApiAuth<Params>(async (ctx, req, { id }) => {
  if (!isUuid(id)) return notFound();
  const body = await readJson(req);
  if (body === undefined) return apiError(400, "bad_request", "Expected a JSON body.");
  return apiResult(await updateClientForOrg(ctx, id, body));
});
