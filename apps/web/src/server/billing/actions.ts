"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { requireOrgContext } from "@/server/auth/context";
import { getStripe, priceIdForPlan } from "@/server/billing/stripe";
import { env } from "@/lib/env";
import type { BillingInterval, PlanId } from "@/lib/plans";
import { cancelOrgSubscription, startPayfastSubscription } from "@/server/billing/payfast";

export interface BillingResult {
  ok: boolean;
  url?: string;
  error?: string;
}

async function ensureCustomer(orgId: string, email?: string, name?: string) {
  const stripe = getStripe();
  if (!stripe) return null;

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  if (sub?.stripeCustomerId) return sub.stripeCustomerId;

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { orgId },
  });

  await db
    .insert(subscriptions)
    .values({ orgId, stripeCustomerId: customer.id, plan: "free" })
    .onConflictDoUpdate({
      target: subscriptions.orgId,
      set: { stripeCustomerId: customer.id },
    });

  return customer.id;
}

export async function startCheckout(plan: PlanId): Promise<BillingResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Billing is not configured on this deployment." };
  }
  const priceId = priceIdForPlan(plan);
  if (!priceId) {
    return { ok: false, error: `No Stripe price configured for the ${plan} plan.` };
  }

  const ctx = await requireOrgContext();
  const customerId = await ensureCustomer(
    ctx.org.id,
    ctx.profile?.email ?? ctx.member.email,
    ctx.profile?.displayName ?? ctx.org.name
  );

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.APP_URL}/settings/billing?status=success`,
    cancel_url: `${env.APP_URL}/settings/billing?status=cancelled`,
    metadata: { orgId: ctx.org.id, plan },
    subscription_data: { metadata: { orgId: ctx.org.id, plan } },
  });

  return { ok: true, url: session.url ?? undefined };
}

export async function openBillingPortal(): Promise<BillingResult> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, error: "Billing is not configured on this deployment." };
  }
  const ctx = await requireOrgContext();
  const customerId = await ensureCustomer(
    ctx.org.id,
    ctx.profile?.email ?? ctx.member.email,
    ctx.profile?.displayName ?? ctx.org.name
  );
  if (!customerId) return { ok: false, error: "No billing account found." };

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.APP_URL}/settings/billing`,
  });
  return { ok: true, url: session.url };
}

/* ───────────────────── Rand subscriptions (PayFast) ───────────────────── */

export type PayfastStartResult =
  | { ok: true; action: string; fields: [string, string][] }
  | { ok: false; error: string };

/** Only the owner or an admin may change what the business pays. */
function canManageBilling(role: string): boolean {
  return role === "owner" || role === "admin";
}

/** The signed form the browser posts to PayFast to set up the subscription. */
export async function startPayfastCheckout(plan: PlanId, interval: BillingInterval): Promise<PayfastStartResult> {
  const ctx = await requireOrgContext();
  if (!canManageBilling(ctx.member.role)) return { ok: false, error: "Only the owner or an admin can change the plan." };
  const res = await startPayfastSubscription(ctx, plan, interval);
  return res.ok ? { ok: true, ...res.data } : { ok: false, error: res.error };
}

export async function cancelSubscription(): Promise<BillingResult> {
  const ctx = await requireOrgContext();
  if (!canManageBilling(ctx.member.role)) return { ok: false, error: "Only the owner or an admin can cancel the plan." };
  const res = await cancelOrgSubscription(ctx);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/settings/billing");
  return { ok: true };
}
