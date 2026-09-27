import { apiResult } from "@/server/api/http";
import { submitProofByToken } from "@/server/proofs/service";
import { readProofUpload } from "@/server/proofs/upload";

export const runtime = "nodejs";

/**
 * Public: the payer uploads proof of payment for a shared invoice.
 * multipart/form-data with `file` (PDF/JPG/PNG/WebP/HEIC, ≤ 5 MB) and
 * optional `amount`, `paidOn` (YYYY-MM-DD), `reference`, `note`.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const upload = await readProofUpload(req);
  if (upload instanceof Response) return upload;
  return apiResult(await submitProofByToken(token, upload.file, upload.fields), 201);
}
