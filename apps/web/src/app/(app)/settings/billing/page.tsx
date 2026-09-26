import { eq } from "drizzle-orm";

import { BillingPanel } from "@/components/settings/billing-panel";
import { requireOrgContext } from "@/server/auth/context";
import { db } from "@/server/db";
import { subscriptions } from "@/server/db/schema";
import { isStripeConfigured } from "@/lib/env";
import { formatDate } from "@/lib/format";

export default async function BillingSettingsPage() {
  const ctx = await requireOrgContext();
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, ctx.org.id))
    .limit(1);

  return (
    <BillingPanel
      currentPlan={ctx.plan.id}
      stripeConfigured={isStripeConfigured}
      renewsOn={sub?.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : null}
    />
  );
}
