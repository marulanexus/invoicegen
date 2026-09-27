import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import {
  documents,
  paymentCheckouts,
  payments,
  type PaymentCheckout,
} from "@/server/db/schema";
import { logActivity } from "@/server/activity";
import { notifyOnlinePayment } from "@/server/notifications/events";
import { fail, ok, type ServiceResult } from "@/server/service-result";
import { balanceOf, statusForAmountPaid } from "@/server/payments/rules";
import { buildPayfastForm, type PayfastMode } from "@/server/gateways/payfast";
import { createYocoCheckout, YocoError } from "@/server/gateways/yoco";
import {
  getGateway,
  payfastSecrets,
  yocoSecrets,
  type Provider,
} from "@/server/gateways/store";
import { env } from "@/lib/env";
import { formatCurrency, round2, toMoneyString, toNumber } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";

/** PayFast won't process less than R5.00 (docs: "Going Live"). */
export const PAYFAST_MIN_AMOUNT = 5;

export type CheckoutStart =
  | { kind: "redirect"; url: string }
  | { kind: "form"; action: string; fields: [string, string][] };

const PROVIDER_LABEL: Record<Provider, string> = { payfast: "PayFast", yoco: "Yoco" };

/**
 * Start paying the outstanding balance of a shared invoice (public, no auth:
 * whoever holds the share link may pay). The amount always comes from the
 * invoice, never from the request.
 */
export async function startCheckout(
  publicToken: string,
  provider: Provider
): Promise<ServiceResult<CheckoutStart>> {
  const rl = rateLimit(`checkout:${publicToken}`, 10, 60_000);
  if (!rl.ok) return fail("rate_limited", "Too many attempts. Please wait a minute and try again.");

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.publicToken, publicToken))
    .limit(1);
  if (!doc || doc.status === "void") return fail("not_found", "Invoice not found.");
  if (doc.type !== "invoice") return fail("conflict", "Only invoices can be paid online.");
  if (doc.currency !== "ZAR") return fail("conflict", "Online payment is only available for invoices in rand (ZAR).");

  const balance = balanceOf(doc);
  if (balance <= 0) return fail("conflict", "This invoice is already paid.");
  if (provider === "payfast" && balance < PAYFAST_MIN_AMOUNT) {
    return fail("conflict", `PayFast can't take payments under ${formatCurrency(PAYFAST_MIN_AMOUNT, "ZAR")}.`);
  }

  const gateway = await getGateway(doc.orgId, provider);
  if (!gateway?.enabled) return fail("not_found", `${PROVIDER_LABEL[provider]} isn't available for this invoice.`);

  const [checkout] = await db
    .insert(paymentCheckouts)
    .values({
      orgId: doc.orgId,
      documentId: doc.id,
      gatewayId: gateway.id,
      provider,
      mode: gateway.mode,
      amount: toMoneyString(balance),
      currency: doc.currency,
    })
    .returning();

  const pageUrl = `${env.APP_URL}/p/${publicToken}`;

  if (provider === "payfast") {
    const secrets = payfastSecrets(gateway);
    const businessName =
      typeof doc.fromSnapshot?.name === "string" ? (doc.fromSnapshot.name as string) : "";
    const form = buildPayfastForm({
      merchantId: gateway.merchantId ?? "",
      merchantKey: secrets.merchantKey,
      passphrase: secrets.passphrase,
      mode: gateway.mode as PayfastMode,
      returnUrl: `${pageUrl}?payment=returned`,
      cancelUrl: `${pageUrl}?payment=cancelled`,
      notifyUrl: `${env.APP_URL}/api/webhooks/payfast`,
      paymentId: checkout.id,
      amount: toMoneyString(balance),
      itemName: `Invoice ${doc.number}`,
      itemDescription: businessName ? `Payment to ${businessName}` : undefined,
      email: typeof doc.billToSnapshot?.email === "string" ? (doc.billToSnapshot.email as string) : null,
    });
    return ok({ kind: "form", ...form });
  }

  try {
    const yoco = await createYocoCheckout(yocoSecrets(gateway).secretKey, {
      checkoutId: checkout.id,
      amountCents: Math.round(round2(balance) * 100),
      successUrl: `${pageUrl}?payment=returned`,
      cancelUrl: `${pageUrl}?payment=cancelled`,
      failureUrl: `${pageUrl}?payment=failed`,
      documentNumber: doc.number,
    });
    await db
      .update(paymentCheckouts)
      .set({ providerReference: yoco.id })
      .where(eq(paymentCheckouts.id, checkout.id));
    return ok({ kind: "redirect", url: yoco.redirectUrl });
  } catch (err) {
    console.error("[checkout] yoco create failed", err);
    await db.update(paymentCheckouts).set({ status: "failed" }).where(eq(paymentCheckouts.id, checkout.id));
    return fail(
      "upstream",
      err instanceof YocoError && err.status === 403
        ? "Card payments are misconfigured for this business."
        : "Couldn't reach Yoco. Please try again."
    );
  }
}

export type CompletionOutcome = "completed" | "already_completed";

/**
 * Record a provider-confirmed payment for a checkout, exactly once. Callers
 * must have verified the notification (signature, amount, source) first.
 * Money that has been taken is always recorded, even if the invoice was paid
 * by other means in the meantime (flagged in the activity log as overpaid).
 */
export async function completeCheckout(
  checkout: PaymentCheckout,
  input: { providerPaymentId: string; amount: number }
): Promise<CompletionOutcome> {
  const result = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(paymentCheckouts)
      .where(eq(paymentCheckouts.id, checkout.id))
      .limit(1)
      .for("update");
    if (!locked || locked.status === "completed") return null;

    const [doc] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, locked.documentId), eq(documents.orgId, locked.orgId)))
      .limit(1)
      .for("update");
    if (!doc) return null;

    const [payment] = await tx
      .insert(payments)
      .values({
        orgId: locked.orgId,
        documentId: doc.id,
        clientId: doc.clientId,
        amount: toMoneyString(input.amount),
        currency: locked.currency,
        method: locked.provider,
        reference: `${PROVIDER_LABEL[locked.provider]} ${input.providerPaymentId}`,
        notes: locked.mode === "test" ? "Test payment" : null,
        paidAt: new Date(),
      })
      .returning();

    const newPaid = round2(toNumber(doc.amountPaid) + input.amount);
    const next = statusForAmountPaid(doc, newPaid);
    await tx
      .update(documents)
      .set({
        amountPaid: toMoneyString(newPaid),
        status: next.status,
        paidAt: next.fullyPaid ? new Date() : doc.paidAt,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id));

    await tx
      .update(paymentCheckouts)
      .set({
        status: "completed",
        providerPaymentId: input.providerPaymentId,
        paymentId: payment.id,
        completedAt: new Date(),
      })
      .where(eq(paymentCheckouts.id, locked.id));

    return { doc, fullyPaid: next.fullyPaid, overpaid: newPaid > toNumber(doc.total) + 0.005 };
  });

  if (!result) return "already_completed";

  await logActivity({
    orgId: checkout.orgId,
    action: "payment.online",
    entityType: "document",
    entityId: result.doc.id,
    description: `${formatCurrency(input.amount, checkout.currency)} paid online via ${PROVIDER_LABEL[checkout.provider]} on ${result.doc.number}${result.overpaid ? " (overpaid — check and refund if needed)" : ""}`,
  });

  notifyOnlinePayment(checkout.orgId, {
    documentId: result.doc.id,
    number: result.doc.number,
    amount: input.amount,
    currency: checkout.currency,
    provider: checkout.provider,
    clientName: typeof result.doc.billToSnapshot?.name === "string" ? (result.doc.billToSnapshot.name as string) : null,
    fullyPaid: result.fullyPaid,
  });
  return "completed";
}
