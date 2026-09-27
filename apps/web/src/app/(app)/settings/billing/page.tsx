import { eq } from "drizzle-orm";

import { BillingPanel } from "@/components/settings/billing-panel";
import { requireOrgContext } from "@/server/auth/context";
import { db } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { listBillingPayments } from "@/server/billing/payfast";
import { env, isPayfastBillingConfigured, isStripeConfigured } from "@/lib/env";
import { formatDate } from "@/lib/format";

export default async function BillingSettingsPage() {
  const ctx = await requireOrgContext();
  const [[sub], history] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.orgId, ctx.org.id)).limit(1),
    listBillingPayments(ctx.org.id),
  ]);

  // South Africa first: rand through PayFast when it's set up, else Stripe.
  const provider = isPayfastBillingConfigured ? "payfast" : isStripeConfigured ? "stripe" : null;

  return (
    <BillingPanel
      currentPlan={ctx.plan.id}
      provider={provider}
      interval={sub?.billingInterval ?? null}
      renewsOn={sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : null}
      cancelling={Boolean(sub?.cancelAtPeriodEnd)}
      subscribedWith={sub?.provider ?? (sub?.stripeSubscriptionId ? "stripe" : null)}
      vatRegistered={Boolean(env.BILLING_VAT_NUMBER)}
      history={history.map((h) => ({
        id: h.id,
        paidOn: formatDate(h.paidAt),
        plan: h.plan,
        interval: h.billingInterval,
        amount: h.amount,
        vatAmount: h.vatAmount,
        periodEnd: formatDate(h.periodEnd),
      }))}
    />
  );
}
