import crypto from "node:crypto";

/**
 * Yoco Checkout API: create a hosted checkout, send the payer to its
 * `redirectUrl`, and confirm payment ONLY from a signed webhook (Yoco's docs:
 * never trust the successUrl). https://developer.yoco.com
 */

const API = "https://payments.yoco.com/api";

export class YocoError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function yocoFetch<T>(secretKey: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new YocoError(`Yoco ${init.method ?? "GET"} ${path} failed (${res.status}) ${detail.slice(0, 200)}`, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export interface YocoCheckout {
  id: string;
  redirectUrl: string;
  status: string;
  processingMode: "live" | "test";
}

export function createYocoCheckout(
  secretKey: string,
  input: {
    /** Our checkout id: idempotency key and external reference. */
    checkoutId: string;
    amountCents: number;
    successUrl: string;
    cancelUrl: string;
    failureUrl: string;
    documentNumber: string;
  }
): Promise<YocoCheckout> {
  return yocoFetch<YocoCheckout>(secretKey, "/checkouts", {
    method: "POST",
    headers: { "Idempotency-Key": input.checkoutId },
    body: JSON.stringify({
      amount: input.amountCents,
      currency: "ZAR",
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      failureUrl: input.failureUrl,
      externalId: input.checkoutId,
      metadata: { invoicegenCheckoutId: input.checkoutId, documentNumber: input.documentNumber },
    }),
  });
}

export interface YocoWebhook {
  id: string;
  name: string;
  url: string;
  mode: "live" | "test";
  secret?: string;
}

/** Lists webhooks; also a cheap way to check that a secret key is valid. */
export async function listYocoWebhooks(secretKey: string): Promise<YocoWebhook[]> {
  const res = await yocoFetch<{ subscriptions?: YocoWebhook[] } | YocoWebhook[]>(secretKey, "/webhooks");
  return Array.isArray(res) ? res : (res.subscriptions ?? []);
}

export function registerYocoWebhook(secretKey: string, url: string): Promise<YocoWebhook> {
  return yocoFetch<YocoWebhook>(secretKey, "/webhooks", {
    method: "POST",
    body: JSON.stringify({ name: "InvoiceGen", url }),
  });
}

export async function deleteYocoWebhook(secretKey: string, webhookId: string): Promise<void> {
  await yocoFetch<void>(secretKey, `/webhooks/${encodeURIComponent(webhookId)}`, { method: "DELETE" });
}

/** Yoco's recommended replay window. */
const TOLERANCE_SECONDS = 180;

/**
 * Verify a webhook per Yoco's docs: HMAC-SHA256 over `id.timestamp.rawBody`
 * with the base64-decoded secret (after "whsec_"), compared in constant time
 * against each `v1,<sig>` entry, and a timestamp within 3 minutes.
 */
export function verifyYocoWebhook(
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  rawBody: string,
  secret: string,
  now: number = Date.now()
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = Buffer.from(
    crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64")
  );

  return signature.split(" ").some((entry) => {
    const [version, sig] = entry.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

export interface YocoPaymentEvent {
  type: string;
  payload?: {
    id?: string;
    amount?: number;
    currency?: string;
    status?: string;
    mode?: "live" | "test";
    metadata?: { checkoutId?: string; [k: string]: unknown };
  };
}
