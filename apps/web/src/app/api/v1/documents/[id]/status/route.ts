import { z } from "zod";

import { apiError, apiResult, isUuid, readJson, withApiAuth } from "@/server/api/http";
import { changeDocumentStatusForOrg, STATUS_ACTIONS } from "@/server/documents/service";

const body = z.object({ action: z.enum(STATUS_ACTIONS) });

/**
 * `{ "action": "send" | "mark_paid" | "void" | "accept" | "decline" | "reopen" }`.
 * "send" only marks it sent; use /send to email it. Returns 409 when the action
 * doesn't fit the document's type or status.
 */
export const POST = withApiAuth<{ id: string }>(async (ctx, req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Document not found.");
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) {
    return apiError(400, "bad_request", `action must be one of: ${STATUS_ACTIONS.join(", ")}.`);
  }
  return apiResult(await changeDocumentStatusForOrg(ctx, id, parsed.data.action));
});
