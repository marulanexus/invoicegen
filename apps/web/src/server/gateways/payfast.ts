import crypto from "node:crypto";
import { lookup } from "node:dns/promises";

/**
 * PayFast "custom integration": the payer is sent to PayFast with a signed
 * form, and PayFast confirms the result with an ITN (Instant Transaction
 * Notification) to our notify_url. Implements the docs at
 * https://developers.payfast.co.za/docs (signature, 4 ITN security checks).
 */

export type PayfastMode = "test" | "live";

export function payfastHost(mode: PayfastMode): string {
  return mode === "live" ? "www.payfast.co.za" : "sandbox.payfast.co.za";
}

/** PHP `urlencode`: spaces as "+", everything but [A-Za-z0-9_.-] %XX (upper case). */
export function phpUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, "+");
}

/**
 * MD5 signature over the non-empty fields in the order given, with the
 * passphrase appended when the merchant has one set.
 */
export function payfastSignature(fields: [string, string][], passphrase?: string | null): string {
  const pairs = fields
    .map(([k, v]) => [k, v.trim()] as const)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${k}=${phpUrlEncode(v)}`);
  if (passphrase) pairs.push(`passphrase=${phpUrlEncode(passphrase.trim())}`);
  return crypto.createHash("md5").update(pairs.join("&")).digest("hex");
}

export interface PayfastPaymentRequest {
  merchantId: string;
  merchantKey: string;
  passphrase?: string | null;
  mode: PayfastMode;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  /** Our checkout id; echoed back in the ITN. */
  paymentId: string;
  amount: string;
  itemName: string;
  itemDescription?: string;
  email?: string | null;
}

/** The form the payer's browser posts to PayFast (fields in PayFast's documented order). */
export function buildPayfastForm(req: PayfastPaymentRequest): {
  action: string;
  fields: [string, string][];
} {
  const fields: [string, string][] = [
    ["merchant_id", req.merchantId],
    ["merchant_key", req.merchantKey],
    ["return_url", req.returnUrl],
    ["cancel_url", req.cancelUrl],
    ["notify_url", req.notifyUrl],
    ["email_address", req.email ?? ""],
    ["m_payment_id", req.paymentId],
    ["amount", req.amount],
    ["item_name", req.itemName.slice(0, 100)],
    ["item_description", (req.itemDescription ?? "").slice(0, 255)],
  ];
  return signedPayfastForm(req.mode, fields, req.passphrase);
}

/**
 * The form to post to PayFast: `fields` in PayFast's documented order, blanks
 * left out, values trimmed (exactly what was signed), then the signature.
 */
export function signedPayfastForm(
  mode: PayfastMode,
  fields: [string, string][],
  passphrase?: string | null
): { action: string; fields: [string, string][] } {
  const nonEmpty = fields
    .map(([k, v]) => [k, v.trim()] as [string, string])
    .filter(([, v]) => v !== "");
  return {
    action: `https://${payfastHost(mode)}/eng/process`,
    fields: [...nonEmpty, ["signature", payfastSignature(nonEmpty, passphrase)]],
  };
}

/** Decode an ITN body (application/x-www-form-urlencoded), keeping field order. */
export function parseItn(rawBody: string): [string, string][] {
  return rawBody
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf("=");
      const key = i < 0 ? pair : pair.slice(0, i);
      const value = i < 0 ? "" : pair.slice(i + 1);
      const decode = (s: string) => decodeURIComponent(s.replace(/\+/g, " "));
      return [decode(key), decode(value)] as [string, string];
    });
}

/**
 * The ITN parameter string as PayFast's reference code builds it: every field
 * before `signature`, re-encoded, in the order received (empty values kept).
 */
export function itnParamString(fields: [string, string][]): string {
  const out: string[] = [];
  for (const [k, v] of fields) {
    if (k === "signature") break;
    out.push(`${k}=${phpUrlEncode(v)}`);
  }
  return out.join("&");
}

/** Security check 1: the ITN signature matches (constant-time). */
export function verifyItnSignature(fields: [string, string][], passphrase?: string | null): boolean {
  const received = fields.find(([k]) => k === "signature")?.[1] ?? "";
  let base = itnParamString(fields);
  if (passphrase) base += `&passphrase=${phpUrlEncode(passphrase.trim())}`;
  const expected = crypto.createHash("md5").update(base).digest("hex");
  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  );
}

/** PayFast's published ITN source ranges (docs: "Ports and IP addresses"). */
const PAYFAST_CIDRS = [
  "197.97.145.144/28",
  "41.74.179.192/27",
  "102.216.36.0/28",
  "102.216.36.128/28",
  "144.126.193.139/32",
];

const PAYFAST_HOSTS = [
  "www.payfast.co.za",
  "sandbox.payfast.co.za",
  "w1w.payfast.co.za",
  "w2w.payfast.co.za",
];

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = n * 256 + Number(p);
  }
  return n;
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const ipN = ipv4ToInt(ip.replace(/^::ffff:/, ""));
  const baseN = ipv4ToInt(base);
  if (ipN === null || baseN === null) return false;
  const bits = Number(bitsStr);
  const size = 2 ** (32 - bits);
  return Math.floor(ipN / size) === Math.floor(baseN / size);
}

/**
 * Security check 2: the request came from PayFast — one of the published
 * ranges, or an address PayFast's hostnames currently resolve to (the check
 * PayFast's reference code performs).
 */
export async function isPayfastSource(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, "");
  if (PAYFAST_CIDRS.some((c) => ipInCidr(clean, c))) return true;
  const resolved = await Promise.all(
    PAYFAST_HOSTS.map((h) => lookup(h, { all: true, family: 4 }).catch(() => []))
  );
  return resolved.flat().some((r) => r.address === clean);
}

/** Security check 3: PayFast's gross amount matches what we asked for (±1c). */
export function amountMatches(expected: string | number, amountGross: string | undefined): boolean {
  if (amountGross === undefined) return false;
  return Math.abs(Number(expected) - Number(amountGross)) <= 0.01;
}

/** Security check 4: PayFast confirms it sent this ITN. */
export async function confirmWithPayfast(fields: [string, string][], mode: PayfastMode): Promise<boolean> {
  const res = await fetch(`https://${payfastHost(mode)}/eng/query/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: itnParamString(fields),
    signal: AbortSignal.timeout(10_000),
  });
  return (await res.text()).trim() === "VALID";
}

/* ───────────────────────── Subscriptions API ───────────────────────── */

/**
 * API signature: every header/body variable plus the passphrase, sorted
 * alphabetically (unlike the form signature), urlencoded, MD5 in lower case.
 * The sandbox's `testing` query flag is left out.
 */
export function payfastApiSignature(vars: Record<string, string>, passphrase: string): string {
  const all: Record<string, string> = { ...vars, passphrase: passphrase.trim() };
  const base = Object.keys(all)
    .sort()
    .filter((k) => all[k] !== "")
    .map((k) => `${k}=${phpUrlEncode(all[k])}`)
    .join("&");
  return crypto.createHash("md5").update(base).digest("hex");
}

/** ISO-8601 in South African time, as the API expects (e.g. 2026-09-27T12:00:01+02:00). */
export function payfastTimestamp(now = new Date()): string {
  const sast = new Date(now.getTime() + 2 * 60 * 60_000);
  return `${sast.toISOString().slice(0, 19)}+02:00`;
}

/** Stop a recurring subscription (PUT /subscriptions/:token/cancel). True when PayFast accepted it. */
export async function cancelPayfastSubscription(opts: {
  token: string;
  merchantId: string;
  passphrase: string;
  mode: PayfastMode;
}): Promise<boolean> {
  const headers = { "merchant-id": opts.merchantId, version: "v1", timestamp: payfastTimestamp() };
  const url = `https://api.payfast.co.za/subscriptions/${encodeURIComponent(opts.token)}/cancel${opts.mode === "test" ? "?testing=true" : ""}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, signature: payfastApiSignature(headers, opts.passphrase) },
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as { data?: { response?: unknown } } | null;
  return res.ok && json?.data?.response !== false;
}
