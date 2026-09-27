import { applyBillingItn, billingMerchant } from "@/server/billing/payfast";
import {
  confirmWithPayfast,
  isPayfastSource,
  parseItn,
  verifyItnSignature,
} from "@/server/gateways/payfast";

export const runtime = "nodejs";

/** Behind Vercel's proxy, the first X-Forwarded-For entry is the caller. */
function callerIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
}

/**
 * PayFast ITN for InvoiceGen's own subscriptions (every recurring charge and
 * cancellation). Runs PayFast's security checks before anything changes; the
 * amount is checked against the plan price in applyBillingItn. A 200 tells
 * PayFast to stop retrying.
 */
export async function POST(req: Request) {
  const merchant = billingMerchant();
  if (!merchant) return new Response("Billing not configured", { status: 404 });

  const fields = parseItn(await req.text());
  const field = (k: string) => fields.find(([f]) => f === k)?.[1];
  const reject = (check: string) => {
    console.warn(`[billing] ITN rejected (${check}) pf_payment_id=${field("pf_payment_id") ?? "?"}`);
    return new Response("Rejected", { status: 400 });
  };

  if (!verifyItnSignature(fields, merchant.passphrase)) return reject("signature");
  if (field("merchant_id") !== merchant.merchantId) return reject("merchant");
  if (!(await isPayfastSource(callerIp(req)))) return reject("source");
  if (!(await confirmWithPayfast(fields, merchant.mode))) return reject("server confirmation");

  const res = await applyBillingItn(field);
  if (!res.ok) return reject(res.error);
  return new Response("OK");
}
