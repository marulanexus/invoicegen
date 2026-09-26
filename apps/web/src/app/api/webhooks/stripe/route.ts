import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import { organizations, subscriptions } from "@/server/db/schema";
import { getStripe, planForPriceId } from "@/server/billing/stripe";
import { env } from "@/lib/env";
import type { PlanId } from "@/lib/plans";

export const runtime = "nodejs";

const STATUS_MAP: Record<string, (typeof subscriptions.$inferInsert)["status"]> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "unpaid",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
};

async function syncSubscription(sub: Stripe.Subscription) {
  const orgId = sub.metadata?.orgId;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price.id;
  const plan: PlanId = sub.status === "active" || sub.status === "trialing"
    ? planForPriceId(priceId)
    : "free";
  const seats = sub.items.data[0]?.quantity ?? 1;
  // current_period_end is seconds since epoch.
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;

  const set = {
    stripeSubscriptionId: sub.id,
    stripeCustomerId: customerId,
    stripePriceId: priceId,
    plan,
    status: STATUS_MAP[sub.status] ?? "active",
    seats,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    updatedAt: new Date(),
  };

  // Prefer orgId from metadata; fall back to matching the customer.
  if (orgId) {
    await db
      .insert(subscriptions)
      .values({ orgId, ...set })
      .onConflictDoUpdate({ target: subscriptions.orgId, set });
    await db
      .update(organizations)
      .set({ plan, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));
  } else {
    const [existing] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);
    if (existing) {
      await db.update(subscriptions).set(set).where(eq(subscriptions.orgId, existing.orgId));
      await db
        .update(organizations)
        .set({ plan, updatedAt: new Date() })
        .where(eq(organizations.id, existing.orgId));
    }
  }
}

export async function POST(req: Request) {
  const stripe = getStripe();
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature failed: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe webhook] handler error", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
