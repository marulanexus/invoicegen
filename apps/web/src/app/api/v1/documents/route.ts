import { z } from "zod";

import { apiData, apiError, apiResult, readJson, withApiAuth } from "@/server/api/http";
import { documentStatusEnum } from "@/server/db/schema";
import { listDocuments } from "@/server/documents/queries";
import { createDocumentForOrg, withProfileDefaults } from "@/server/documents/service";

const listQuery = z.object({
  type: z.enum(["invoice", "quote", "receipt"]).optional(),
  status: z.enum([...documentStatusEnum.enumValues, "all"]).optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * Newest first. `?type=invoice|quote|receipt&status=…&clientId=…&search=…&limit=50`
 */
export const GET = withApiAuth(async (ctx, req) => {
  const p = new URL(req.url).searchParams;
  const q = listQuery.safeParse(Object.fromEntries(p.entries()));
  if (!q.success) return apiError(400, "bad_request", "Invalid query parameters.");

  return apiData(await listDocuments(ctx.org.id, q.data));
});

/**
 * Create a draft. Omitted fields (currency, dates, tax, template, notes, line
 * tax rates) default from the business profile, like the web builder.
 */
export const POST = withApiAuth(async (ctx, req) => {
  const body = await readJson(req);
  if (body === undefined) return apiError(400, "bad_request", "Expected a JSON body.");
  return apiResult(await createDocumentForOrg(ctx, withProfileDefaults(body, ctx.profile)), 201);
});
