/**
 * What a payer may upload as proof of payment, identified by the file's own
 * bytes ("magic numbers"), never by the name or the browser's claimed type.
 * That keeps HTML/SVG (script-capable) files out of storage even if renamed.
 */

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;

export interface ProofFileType {
  contentType: string;
  ext: string;
}

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  return sig.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

/** HEIF/HEIC brands phones write (iPhone photos are HEIC). */
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);

export function sniffProofFile(bytes: Uint8Array): ProofFileType | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { contentType: "application/pdf", ext: "pdf" }; // %PDF-
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { contentType: "image/jpeg", ext: "jpg" };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { contentType: "image/png", ext: "png" };
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return { contentType: "image/webp", ext: "webp" };
  if (ascii(bytes, 4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(bytes, 8, 12))) return { contentType: "image/heic", ext: "heic" };
  return null;
}

/** A display name safe to store and show: no path, tame characters, right extension. */
export function safeFileName(name: string | null | undefined, ext: string): string {
  const base = (name ?? "")
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, "")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .slice(0, 60);
  return `${base || "proof-of-payment"}.${ext}`;
}
