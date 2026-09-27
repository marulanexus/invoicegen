import "server-only";

import crypto from "node:crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/server/db";
import { billingPayments, organizations, subscriptions, type BillingPayment } from "@/server/db/schema";
import type { OrgContext } from "@/server/auth/context";
import { logActivity } from "@/server/activity";
import { fail, ok, type ServiceResult } from "@/server/service-result";
import { env, isPayfastBillingConfigured } from "@/lib/env";
import { toMoneyString } from "@/lib/money";
import { zarPrice, type BillingInterval } from "@/lib/plans";
import { cancelPayfastSubscription, signedPayfastForm } from "@/server/gateways/payfast";
import {
  isInterval,
  isLapsed,
  isPaidPlan,
  periodEndAfter,
  subscriptionFields,
  vatIncluded,
  type PaidPlan,
} from "@/server/billing/rules";

/**
 * InvoiceGen's own rand subscriptions through PayFast recurring billing, on
 * Marula Nexus's merchant account. PayFast charges the card every cycle and
 * sends an ITN each time; the ITN (after its security checks) is what moves
 * an org onto a plan. Cancelling keeps the plan until the paid period ends.
 */

function merchant() {
  if (!isPayfastBillingConfigured) return null;
  return {
    merchantId: env.PAYFAST_BILLING_MERCHANT_ID!,
    merchantKey: env.PAYFAST_BILLING_MERCHANT_KEY!,
    passphrase: env.PAYFAST_BILLING_PASSPHRASE!,
    mode: env.PAYFAST_BILLING_MODE,
  };
}

export function billingMerchant() {
  return merchant();
}

/** The signed form that sends the owner to PayFast to set up the subscription. */
export async function startPayfastSubscription(
  ctx: OrgContext,
  plan: unknown,
  interval: unknown
): Promise<ServiceResult<{ action: string; fields: [string, string][] }>> {
  const m = merchant();
  if (!m) return fail("conflict", "Rand billing isn't set up on this deployment yet.");
  if (!isPaidPlan(plan) || !isInterval(interval)) return fail("validation", "Choose a paid plan and how often to pay.");

  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, ctx.org.id)).limit(1);
  if (
    sub?.provider === "payfast" &&
    sub.plan === plan &&
    sub.billingInterval === interval &&
    !sub.cancelAtPeriodEnd &&
    ctx.plan.id === plan
  ) {
    return fail("conflict", "You're already on this plan.");
  }

  const form = signedPayfastForm(
    m.mode,
    subscriptionFields({
      merchantId: m.merchantId,
      merchantKey: m.merchantKey,
      returnUrl: `${env.APP_URL}/settings/billing?status=success`,
      cancelUrl: `${env.APP_URL}/settings/billing?status=cancelled`,
      notifyUrl: `${env.APP_URL}/api/webhooks/payfast-billing`,
      name: ctx.profile?.displayName ?? ctx.org.name,
      email: ctx.profile?.email ?? ctx.member.email,
      paymentId: crypto.randomUUID(),
      orgId: ctx.org.id,
      plan,
      interval,
    }),
    m.passphrase
  );
  return ok(form);
}

type ItnField = (key: string) => string | undefined;

/**
 * Apply a verified billing ITN. COMPLETE: record the charge (once per
 * pf_payment_id) and put the org on the plan until the period ends.
 * CANCELLED: keep the plan until the period ends, then the daily job lapses it.
 */
export async function applyBillingItn(field: ItnField): Promise<ServiceResult<{ outcome: string }>> {
  const token = field("token") ?? "";
  const status = field("payment_status");

  // First charge: custom_str1..3 carry the org and plan. Later charges and
  // cancellations are matched on the token as well.
  const [byToken] = token
    ? await db.select().from(subscriptions).where(eq(subscriptions.payfastToken, token)).limit(1)
    : [];
  const orgId = field("custom_str1") || byToken?.orgId;
  const plan = field("custom_str2") || byToken?.plan;
  const interval = field("custom_str3") || byToken?.billingInterval;
  if (!orgId || !isPaidPlan(plan) || !isInterval(interval)) return fail("validation", "Unknown subscription.");

  if (status === "CANCELLED") {
    // Only the org's current subscription; an old one replaced by a plan switch is ignored.
    if (!byToken || byToken.orgId !== orgId) return ok({ outcome: "ignored" });
    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(subscriptions.id, byToken.id));
    return ok({ outcome: "cancelled" });
  }
  if (status !== "COMPLETE") return ok({ outcome: "ignored" });

  if (!field("pf_payment_id")) return fail("validation", "Missing PayFast payment id.");
  const amount = Number(field("amount_gross"));
  const expected = zarPrice(plan, interval)!;
  if (!(Math.abs(amount - expected) <= 0.01)) return fail("validation", "Amount doesn't match the plan.");

  const paidAt = new Date();
  const periodEnd = periodEndAfter(paidAt, interval);
  const vatNumber = env.BILLING_VAT_NUMBER ?? null;

  const result = await db.transaction(async (tx) => {
    const [org] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org) return fail("not_found", "Unknown organisation.");

    const [payment] = await tx
      .insert(billingPayments)
      .values({
        orgId,
        provider: "payfast",
        providerPaymentId: field("pf_payment_id") ?? "",
        plan,
        billingInterval: interval,
        amount: toMoneyString(amount),
        vatAmount: toMoneyString(vatIncluded(amount, Boolean(vatNumber))),
        vatNumber,
        periodEnd,
        paidAt,
      })
      .onConflictDoNothing({ target: billingPayments.providerPaymentId })
      .returning();
    if (!payment) return ok({ outcome: "duplicate", replacedToken: null as string | null });

    const [current] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.orgId, orgId))
      .limit(1)
      .for("update");
    const replacedToken =
      current?.payfastToken && current.payfastToken !== token ? current.payfastToken : null;

    const set = {
      provider: "payfast" as const,
      plan,
      billingInterval: interval,
      payfastToken: token || current?.payfastToken || null,
      status: "active" as const,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: periodEnd,
      updatedAt: new Date(),
    };
    if (current) {
      await tx.update(subscriptions).set(set).where(eq(subscriptions.id, current.id));
    } else {
      await tx.insert(subscriptions).values({ orgId, ...set });
    }
    await tx.update(organizations).set({ plan, updatedAt: new Date() }).where(eq(organizations.id, orgId));
    return ok({ outcome: "paid", replacedToken });
  });
  if (!result.ok) return result;

  // Switched plans: the old subscription must stop charging.
  const m = merchant();
  if (m && result.data.replacedToken) {
    const stopped = await cancelPayfastSubscription({ token: result.data.replacedToken, ...m }).catch(() => false);
    if (!stopped) console.error(`[billing] could not cancel replaced PayFast subscription for org ${orgId}`);
  }

  if (result.data.outcome === "paid") {
    await logActivity({
      orgId,
      actorMemberId: null,
      action: "billing.paid",
      entityType: "subscription",
      entityId: undefined,
      description: `InvoiceGen ${plan} (${interval}) paid: R ${amount.toFixed(2)}`,
    });
  }
  return ok({ outcome: result.data.outcome });
}

/** Stop future charges; the plan stays until the paid period ends. */
export async function cancelOrgSubscription(ctx: OrgContext): Promise<ServiceResult<{ endsOn: Date | null }>> {
  const m = merchant();
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, ctx.org.id)).limit(1);
  if (!m || sub?.provider !== "payfast" || !sub.payfastToken) return fail("not_found", "No rand subscription to cancel.");
  if (sub.cancelAtPeriodEnd) return fail("conflict", "Your subscription is already cancelled.");

  const stopped = await cancelPayfastSubscription({ token: sub.payfastToken, ...m }).catch(() => false);
  if (!stopped) return fail("upstream", "PayFast couldn't cancel the subscription. Please try again.");

  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptions.id, sub.id));
  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "billing.cancelled",
    entityType: "subscription",
    entityId: sub.id,
    description: "Cancelled the InvoiceGen subscription",
  });
  return ok({ endsOn: sub.currentPeriodEnd });
}

/**
 * Daily: orgs whose PayFast subscription stopped paying (cancelled, or the
 * card kept failing) drop to Free once the period and grace days are over.
 */
export async function expireLapsedSubscriptions(now = new Date()): Promise<number> {
  const subs = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.provider, "payfast"), isNotNull(subscriptions.currentPeriodEnd)));
  let expired = 0;
  for (const sub of subs.filter((s) => isLapsed(s, now))) {
    await db.transaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({ plan: "free", status: "canceled", cancelAtPeriodEnd: false, payfastToken: null, updatedAt: now })
        .where(eq(subscriptions.id, sub.id));
      await tx.update(organizations).set({ plan: "free", updatedAt: now }).where(eq(organizations.id, sub.orgId));
    });
    expired++;
  }
  return expired;
}

export async function listBillingPayments(orgId: string, limit = 24): Promise<BillingPayment[]> {
  return db
    .select()
    .from(billingPayments)
    .where(eq(billingPayments.orgId, orgId))
    .orderBy(desc(billingPayments.paidAt))
    .limit(limit);
}

export type { BillingInterval, PaidPlan };
