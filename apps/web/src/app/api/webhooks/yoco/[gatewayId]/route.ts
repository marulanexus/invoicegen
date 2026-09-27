import { and, eq, or } from "drizzle-orm";

import { db } from "@/server/db";
import { paymentCheckouts } from "@/server/db/schema";
import { isUuid } from "@/server/api/http";
import { completeCheckout } from "@/server/gateways/checkout";
import { getGatewayById, yocoSecrets } from "@/server/gateways/store";
import { verifyYocoWebhook, type YocoPaymentEvent } from "@/server/gateways/yoco";
import { toNumber } from "@/lib/money";

export const runtime = "nodejs";

/**
 * Yoco webhook for one business's connected account (the URL carries the
 * gateway id so we know whose signing secret to use).
 */
export async function POST(req: Request, { params }: { params: Promise<{ gatewayId: string }> }) {
  const { gatewayId } = await params;
  if (!isUuid(gatewayId)) return new Response("Not found", { status: 404 });

  const gateway = await getGatewayById(gatewayId);
  const secret = gateway?.provider === "yoco" ? yocoSecrets(gateway).webhookSecret : undefined;
  if (!gateway || !secret) return new Response("Not found", { status: 404 });

  const raw = await req.text();
  const verified = verifyYocoWebhook(
    {
      id: req.headers.get("webhook-id"),
      timestamp: req.headers.get("webhook-timestamp"),
      signature: req.headers.get("webhook-signature"),
    },
    raw,
    secret
  );
  if (!verified) {
    console.warn(`[yoco] webhook signature rejected for gateway ${gateway.id}`);
    return new Response("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(raw) as YocoPaymentEvent;
  const metadata = event.payload?.metadata ?? {};
  // Yoco's checkout id, or our own id if Yoco carries checkout metadata over.
  const yocoCheckoutId = typeof metadata.checkoutId === "string" ? metadata.checkoutId : null;
  const ownId =
    typeof metadata.invoicegenCheckoutId === "string" && isUuid(metadata.invoicegenCheckoutId)
      ? metadata.invoicegenCheckoutId
      : null;
  if (!yocoCheckoutId && !ownId) return new Response("OK"); // not a checkout payment

  const [checkout] = await db
    .select()
    .from(paymentCheckouts)
    .where(
      and(
        eq(paymentCheckouts.provider, "yoco"),
        eq(paymentCheckouts.orgId, gateway.orgId),
        or(
          yocoCheckoutId ? eq(paymentCheckouts.providerReference, yocoCheckoutId) : undefined,
          ownId ? eq(paymentCheckouts.id, ownId) : undefined
        )
      )
    )
    .limit(1);
  // Payments the business takes through Yoco outside InvoiceGen: not ours.
  if (!checkout) return new Response("OK");

  if (event.type === "payment.succeeded") {
    const p = event.payload!;
    const expectedCents = Math.round(toNumber(checkout.amount) * 100);
    if (p.status !== "succeeded" || p.currency !== "ZAR" || p.amount !== expectedCents) {
      console.warn(`[yoco] payment ${p.id} doesn't match checkout ${checkout.id}`);
      return new Response("Mismatch", { status: 400 });
    }
    await completeCheckout(checkout, { providerPaymentId: p.id ?? "", amount: p.amount / 100 });
  } else if (event.type === "payment.failed") {
    await db
      .update(paymentCheckouts)
      .set({ status: "failed" })
      .where(and(eq(paymentCheckouts.id, checkout.id), eq(paymentCheckouts.status, "pending")));
  }

  return new Response("OK");
}
