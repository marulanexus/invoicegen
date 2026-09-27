import { addDays, addMonths, addYears } from "date-fns";

import { round2 } from "@/lib/money";
import { PLANS, zarPrice, type BillingInterval, type PlanId } from "@/lib/plans";

/**
 * Pure rules for InvoiceGen's own rand subscriptions (PayFast recurring
 * billing). No DB or network: used by ./payfast.ts and unit-tested directly.
 */

/** PayFast `frequency`: 3 = monthly, 6 = annual. */
export const PAYFAST_FREQUENCY: Record<BillingInterval, string> = { monthly: "3", yearly: "6" };

/** Days a paid plan keeps working after its period ends, while PayFast retries a failed card. */
export const GRACE_DAYS = 3;

export const VAT_RATE = 15;

/** When the period paid for today ends. */
export function periodEndAfter(paidAt: Date, interval: BillingInterval): Date {
  return interval === "yearly" ? addYears(paidAt, 1) : addMonths(paidAt, 1);
}

/** VAT inside a VAT-inclusive price; zero until Marula Nexus is VAT-registered. */
export function vatIncluded(amount: number, vatRegistered: boolean): number {
  return vatRegistered ? round2((amount * VAT_RATE) / (100 + VAT_RATE)) : 0;
}

/**
 * A PayFast subscription that has stopped paying: cancelled, or the card kept
 * failing, and the period (plus grace) is over. The org drops to Free.
 */
export function isLapsed(
  sub: { provider: string | null; plan: string; currentPeriodEnd: Date | null },
  now: Date
): boolean {
  if (sub.provider !== "payfast" || sub.plan === "free" || !sub.currentPeriodEnd) return false;
  return now > addDays(sub.currentPeriodEnd, GRACE_DAYS);
}

export type PaidPlan = Exclude<PlanId, "free">;

export function isPaidPlan(v: unknown): v is PaidPlan {
  return v === "growth" || v === "business";
}

export function isInterval(v: unknown): v is BillingInterval {
  return v === "monthly" || v === "yearly";
}

/**
 * The PayFast subscription form fields, in PayFast's documented order. The org,
 * plan and interval travel in custom_str1..3 and come back in every ITN.
 */
export function subscriptionFields(opts: {
  merchantId: string;
  merchantKey: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
  name?: string | null;
  email?: string | null;
  paymentId: string;
  orgId: string;
  plan: PaidPlan;
  interval: BillingInterval;
}): [string, string][] {
  const amount = zarPrice(opts.plan, opts.interval)!;
  const plan = PLANS[opts.plan];
  return [
    ["merchant_id", opts.merchantId],
    ["merchant_key", opts.merchantKey],
    ["return_url", opts.returnUrl],
    ["cancel_url", opts.cancelUrl],
    ["notify_url", opts.notifyUrl],
    ["name_first", (opts.name ?? "").slice(0, 100)],
    ["email_address", (opts.email ?? "").slice(0, 100)],
    ["m_payment_id", opts.paymentId],
    ["amount", amount.toFixed(2)],
    ["item_name", `InvoiceGen ${plan.name} (${opts.interval})`],
    ["custom_str1", opts.orgId],
    ["custom_str2", opts.plan],
    ["custom_str3", opts.interval],
    ["subscription_type", "1"],
    ["recurring_amount", amount.toFixed(2)],
    ["frequency", PAYFAST_FREQUENCY[opts.interval]],
    ["cycles", "0"],
  ];
}
