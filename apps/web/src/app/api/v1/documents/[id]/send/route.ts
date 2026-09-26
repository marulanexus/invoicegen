import { z } from "zod";

import { apiError, apiResult, isUuid, readJson, withApiAuth } from "@/server/api/http";
import { sendDocumentForOrg } from "@/server/documents/sending";

const body = z.object({
  to: z.string().trim().email().optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().max(5000).optional(),
});

/**
 * Email the PDF (to the client's email unless `to` is given) and mark it sent.
 * Body is optional: `{ "to"?, "subject"?, "message"? }`.
 */
export const POST = withApiAuth<{ id: string }>(async (ctx, req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Document not found.");
  const parsed = body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) {
    return apiError(422, "validation", "Please check the highlighted fields.", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }
  return apiResult(await sendDocumentForOrg(ctx, id, parsed.data));
});
