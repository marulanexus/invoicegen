import "server-only";

import { put } from "@vercel/blob";

import { env, isBlobConfigured } from "@/lib/env";

/**
 * Thin wrapper over Vercel Blob. When no token is configured these are no-ops
 * that signal "not stored" so callers degrade gracefully (e.g. keep a pasted
 * logo URL, or generate PDFs on demand instead of from storage).
 */

export async function uploadFile(
  path: string,
  data: Buffer | Blob,
  contentType?: string
): Promise<string | null> {
  if (!isBlobConfigured) return null;
  const blob = await put(path, data, {
    access: "public",
    token: env.BLOB_READ_WRITE_TOKEN,
    contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}
