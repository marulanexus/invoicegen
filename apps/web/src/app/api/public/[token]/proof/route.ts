import { apiError, apiResult } from "@/server/api/http";
import { MAX_PROOF_BYTES } from "@/server/proofs/files";
import { submitProofByToken } from "@/server/proofs/service";

export const runtime = "nodejs";

/**
 * Public: the payer uploads proof of payment for a shared invoice.
 * multipart/form-data with `file` (PDF/JPG/PNG/WebP/HEIC, ≤ 5 MB) and
 * optional `amount`, `paidOn` (YYYY-MM-DD), `reference`, `note`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Refuse oversized bodies before reading them into memory.
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_PROOF_BYTES + 64 * 1024) {
    return apiError(422, "validation", "That file is too big (5 MB max).", { file: ["Max 5 MB"] });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, "bad_request", "Expected a file upload.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return apiError(422, "validation", "Choose a file to upload.", { file: ["Required"] });
  }
  if (file.size > MAX_PROOF_BYTES) {
    return apiError(422, "validation", "That file is too big (5 MB max).", { file: ["Max 5 MB"] });
  }

  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return apiResult(
    await submitProofByToken(
      token,
      { name: file.name, size: file.size, bytes: new Uint8Array(await file.arrayBuffer()) },
      { amount: field("amount"), paidOn: field("paidOn"), reference: field("reference"), note: field("note") }
    ),
    201
  );
}
