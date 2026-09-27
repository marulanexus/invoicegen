import { apiError, apiResult, isUuid, readJson, withApiAuth } from "@/server/api/http";
import { issueNoteForOrg } from "@/server/documents/notes";

/**
 * Issue a credit or debit note against an issued invoice (VAT Act s21):
 * `{ kind: "credit" | "debit", reason, mode?: "full" | "amount", amount?, description?, taxRate?, issueDate? }`.
 * Amounts include VAT. Returns the note and the updated invoice; 409 when the
 * invoice can't take the note (draft, void, or crediting more than is left).
 */
export const POST = withApiAuth<{ id: string }>(async (ctx, req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Invoice not found.");
  const body = await readJson(req);
  if (body === undefined) return apiError(400, "bad_request", "Expected a JSON body.");
  return apiResult(await issueNoteForOrg(ctx, id, body), 201);
});
