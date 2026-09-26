import "server-only";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  env,
  isPrivateStorageConfigured,
  isPublicStorageConfigured,
} from "@/lib/env";

/**
 * Cloudflare R2 object storage (S3 API), split into two buckets:
 *
 * - **Public** — assets meant to be seen by anyone with the link (logos shown
 *   on PDFs and public invoice pages). Served from `R2_PUBLIC_URL`.
 * - **Private** — client documents (archived PDFs, later proof of payment).
 *   Never public; read through short-lived signed URLs only.
 *
 * When a bucket isn't configured the upload helpers return `null` so callers
 * degrade gracefully (keep a pasted logo URL, render PDFs on demand).
 */

let client: S3Client | undefined;

function r2(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

/** Upload to the public bucket. Returns the public URL, or null if unconfigured. */
export async function uploadPublicFile(
  key: string,
  data: Buffer,
  contentType: string
): Promise<string | null> {
  if (!isPublicStorageConfigured) return null;
  await r2().send(
    new PutObjectCommand({
      Bucket: env.R2_PUBLIC_BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
      // Keys are unique per upload, so the object never changes.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return `${env.R2_PUBLIC_URL}/${key}`;
}

/** Upload to the private bucket. Returns the object key, or null if unconfigured. */
export async function uploadPrivateFile(
  key: string,
  data: Buffer,
  contentType: string
): Promise<string | null> {
  if (!isPrivateStorageConfigured) return null;
  await r2().send(
    new PutObjectCommand({
      Bucket: env.R2_PRIVATE_BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Short-lived download URL for a private object. Callers must check the key
 * belongs to the current org before handing the URL out.
 */
export async function getPrivateFileUrl(
  key: string,
  expiresInSeconds = 300
): Promise<string | null> {
  if (!isPrivateStorageConfigured) return null;
  return getSignedUrl(
    r2(),
    new GetObjectCommand({ Bucket: env.R2_PRIVATE_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}
