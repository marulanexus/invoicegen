import "server-only";

import crypto from "node:crypto";

/**
 * Symmetric encryption for secrets at rest (e.g. user SMTP passwords).
 * Uses AES-256-GCM. The key comes from APP_ENCRYPTION_KEY (32-byte hex/base64).
 * If unset in development we derive a stable-but-insecure key so the app keeps
 * working — production MUST set a real key.
 */
function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (raw) {
    const buf = raw.length === 64 ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_ENCRYPTION_KEY must be a 32-byte key in production.");
  }
  return crypto.createHash("sha256").update("invoicegen-dev-key").digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
