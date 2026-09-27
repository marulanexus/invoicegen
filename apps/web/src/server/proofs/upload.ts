import "server-only";

import { apiError } from "@/server/api/http";
import { MAX_PROOF_BYTES } from "@/server/proofs/files";

export type ProofUpload = {
  file: { name: string; size: number; bytes: Uint8Array };
  fields: Record<string, string | undefined>;
};

/**
 * Parse a proof-of-payment upload (multipart: \`file\` + optional amount,
 * paidOn, reference, note). Oversized bodies are refused before reading.
 * Returns the upload, or the error response to send.
 */
export async function readProofUpload(req: Request): Promise<ProofUpload | Response> {
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
  return {
    file: { name: file.name, size: file.size, bytes: new Uint8Array(await file.arrayBuffer()) },
    fields: { amount: field("amount"), paidOn: field("paidOn"), reference: field("reference"), note: field("note") },
  };
}
