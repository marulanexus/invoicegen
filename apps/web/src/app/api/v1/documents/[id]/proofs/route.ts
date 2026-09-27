import { apiError, apiResult, isUuid, withApiAuth } from "@/server/api/http";
import { addProofForOrg } from "@/server/proofs/service";
import { readProofUpload } from "@/server/proofs/upload";

export const runtime = "nodejs";

/**
 * The owner adds a proof of payment (e.g. a screenshot the client sent on
 * WhatsApp): multipart with `file` and optional `amount`, `paidOn`,
 * `reference`, `note`. Returns the pending proof; accept it to record the
 * payment (POST /proofs/:id/accept).
 */
export const POST = withApiAuth<{ id: string }>(async (ctx, req, { id }) => {
  if (!isUuid(id)) return apiError(404, "not_found", "Invoice not found.");
  const upload = await readProofUpload(req);
  if (upload instanceof Response) return upload;
  return apiResult(await addProofForOrg(ctx, id, upload.file, upload.fields), 201);
});
