import "server-only";

import Stripe from "stripe";

import { env, isStripeConfigured } from "@/lib/env";
import type { PlanId } from "@/lib/plans";

let cached: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (!isStripeConfigured) return null;
  if (!cached) cached = new Stripe(env.STRIPE_SECRET_KEY!);
  return cached;
}

/** Map an internal plan id to its configured Stripe Price id. */
export function priceIdForPlan(plan: PlanId): string | undefined {
  if (plan === "growth") return env.STRIPE_PRICE_GROWTH;
  if (plan === "business") return env.STRIPE_PRICE_BUSINESS;
  return undefined;
}

/** Reverse lookup: which plan does a Stripe Price id correspond to. */
export function planForPriceId(priceId: string | null | undefined): PlanId {
  if (priceId && priceId === env.STRIPE_PRICE_GROWTH) return "growth";
  if (priceId && priceId === env.STRIPE_PRICE_BUSINESS) return "business";
  return "free";
}
