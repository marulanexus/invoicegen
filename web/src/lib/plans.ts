/**
 * Pricing tiers and the feature/limit matrix used for enforcement.
 * Mirror these `priceId`s with the Stripe Price IDs in your env.
 */

export type PlanId = "free" | "growth" | "business";

export interface PlanFeatures {
  recurringInvoices: boolean;
  automatedReminders: boolean;
  multipleSeats: boolean;
  customBranding: boolean; // remove "Powered by InvoiceGen"
  advancedReporting: boolean;
}

export interface PlanLimits {
  /** -1 means unlimited. */
  maxClients: number;
  /** Documents creatable per calendar month. -1 = unlimited. */
  maxDocumentsPerMonth: number;
  maxSeats: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceEnvKey?: "STRIPE_PRICE_GROWTH" | "STRIPE_PRICE_BUSINESS";
  limits: PlanLimits;
  features: PlanFeatures;
  highlights: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free Starter",
    tagline: "Everything you need to send your first invoices.",
    priceMonthly: 0,
    limits: { maxClients: 3, maxDocumentsPerMonth: 5, maxSeats: 1 },
    features: {
      recurringInvoices: false,
      automatedReminders: false,
      multipleSeats: false,
      customBranding: false,
      advancedReporting: false,
    },
    highlights: [
      "Up to 3 clients",
      "5 documents / month",
      "Invoices, quotes & receipts",
      "Professional PDF + email",
      "Basic templates",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth Pro",
    tagline: "Automate the busywork as you scale.",
    priceMonthly: 18,
    priceEnvKey: "STRIPE_PRICE_GROWTH",
    limits: { maxClients: -1, maxDocumentsPerMonth: -1, maxSeats: 1 },
    features: {
      recurringInvoices: true,
      automatedReminders: true,
      multipleSeats: false,
      customBranding: false,
      advancedReporting: false,
    },
    highlights: [
      "Unlimited clients & documents",
      "Automated payment reminders",
      "Recurring invoices",
      "All templates",
      "Priority email support",
    ],
  },
  business: {
    id: "business",
    name: "Business Plus",
    tagline: "For teams that bill together.",
    priceMonthly: 32,
    priceEnvKey: "STRIPE_PRICE_BUSINESS",
    limits: { maxClients: -1, maxDocumentsPerMonth: -1, maxSeats: 10 },
    features: {
      recurringInvoices: true,
      automatedReminders: true,
      multipleSeats: true,
      customBranding: true,
      advancedReporting: true,
    },
    highlights: [
      "Everything in Growth Pro",
      "Up to 10 team seats",
      "Custom branding (remove “Powered by”)",
      "Advanced reporting",
      "Multi-user roles & permissions",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "growth", "business"];

export function getPlan(id: PlanId | string | null | undefined): Plan {
  if (id && id in PLANS) return PLANS[id as PlanId];
  return PLANS.free;
}

export function isUnlimited(limit: number): boolean {
  return limit === -1;
}
