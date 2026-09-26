import { z } from "zod";

import { apiData, apiError, apiResult, readJson, withApiAuth } from "@/server/api/http";
import { listClients } from "@/server/clients/queries";
import { createClientForOrg } from "@/server/clients/service";

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
});

/** List clients with per-client totals. `?search=&status=active|archived|all`. */
export const GET = withApiAuth(async (ctx, req) => {
  const params = new URL(req.url).searchParams;
  const q = listQuery.safeParse({
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
  });
  if (!q.success) return apiError(400, "bad_request", "Invalid query parameters.");

  return apiData(await listClients(ctx.org.id, q.data));
});

export const POST = withApiAuth(async (ctx, req) => {
  const body = await readJson(req);
  if (body === undefined) return apiError(400, "bad_request", "Expected a JSON body.");
  return apiResult(await createClientForOrg(ctx, body), 201);
});
