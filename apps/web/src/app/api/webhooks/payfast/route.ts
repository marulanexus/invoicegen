import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { paymentCheckouts } from "@/server/db/schema";
import { isUuid } from "@/server/api/http";
import { completeCheckout } from "@/server/gateways/checkout";
import {
  amountMatches,
  confirmWithPayfast,
  isPayfastSource,
  parseItn,
  verifyItnSignature,
  type PayfastMode,
} from "@/server/gateways/payfast";
import { getGatewayById, payfastSecrets } from "@/server/gateways/store";

export const runtime = "nodejs";

/** Behind Vercel's proxy, the first X-Forwarded-For entry is the caller. */
function callerIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
}

/**
 * PayFast ITN. Runs all four checks from PayFast's docs before recording
 * anything; a 200 tells PayFast to stop retrying.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const fields = parseItn(raw);
  const field = (k: string) => fields.find(([f]) => f === k)?.[1];

  const checkoutId = field("m_payment_id");
  if (!checkoutId || !isUuid(checkoutId)) return new Response("Unknown payment", { status: 400 });

  const [checkout] = await db
    .select()
    .from(paymentCheckouts)
    .where(and(eq(paymentCheckouts.id, checkoutId), eq(paymentCheckouts.provider, "payfast")))
    .limit(1);
  const gateway = checkout?.gatewayId ? await getGatewayById(checkout.gatewayId) : null;
  if (!checkout || !gateway || gateway.orgId !== checkout.orgId) {
    return new Response("Unknown payment", { status: 400 });
  }

  const mode = checkout.mode as PayfastMode;
  const reject = (check: string) => {
    console.warn(`[payfast] ITN rejected (${check}) for checkout ${checkout.id}`);
    return new Response("Rejected", { status: 400 });
  };

  // 1. Signature, then the cheap data checks, then the network checks.
  if (!verifyItnSignature(fields, payfastSecrets(gateway).passphrase)) return reject("signature");
  if (field("merchant_id") !== gateway.merchantId) return reject("merchant");
  // 3. Amount: what PayFast took must be what we asked for.
  if (!amountMatches(checkout.amount, field("amount_gross"))) return reject("amount");
  // 2. Source: PayFast's servers only.
  if (!(await isPayfastSource(callerIp(req)))) return reject("source");
  // 4. PayFast confirms it sent this notification.
  if (!(await confirmWithPayfast(fields, mode))) return reject("server confirmation");

  const status = field("payment_status");
  if (status === "COMPLETE") {
    await completeCheckout(checkout, {
      providerPaymentId: field("pf_payment_id") ?? "",
      amount: Number(field("amount_gross")),
    });
  } else if (status === "CANCELLED") {
    await db
      .update(paymentCheckouts)
      .set({ status: "failed" })
      .where(and(eq(paymentCheckouts.id, checkout.id), eq(paymentCheckouts.status, "pending")));
  }

  return new Response("OK");
}
