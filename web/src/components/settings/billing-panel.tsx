"use client";

import { useTransition } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/plans";
import { openBillingPortal, startCheckout } from "@/server/billing/actions";

export function BillingPanel({
  currentPlan,
  stripeConfigured,
  renewsOn,
}: {
  currentPlan: PlanId;
  stripeConfigured: boolean;
  renewsOn?: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function upgrade(plan: PlanId) {
    startTransition(async () => {
      const res = await startCheckout(plan);
      if (!res.ok || !res.url) {
        toast.error(res.error ?? "Could not start checkout");
        return;
      }
      window.location.href = res.url;
    });
  }

  function manage() {
    startTransition(async () => {
      const res = await openBillingPortal();
      if (!res.ok || !res.url) {
        toast.error(res.error ?? "Could not open billing portal");
        return;
      }
      window.location.href = res.url;
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-lg font-semibold">
              {PLANS[currentPlan].name}{" "}
              {currentPlan !== "free" && <Badge variant="success">Active</Badge>}
            </p>
            {renewsOn && (
              <p className="text-xs text-muted-foreground">Renews {renewsOn}</p>
            )}
          </div>
          {currentPlan !== "free" && stripeConfigured && (
            <Button variant="outline" onClick={manage} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Manage billing
            </Button>
          )}
        </CardContent>
      </Card>

      {!stripeConfigured && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          Billing is not configured on this deployment. Add your Stripe keys and
          price IDs to <code className="font-mono">.env.local</code> to enable
          paid plans.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const isCurrent = id === currentPlan;
          const order = PLAN_ORDER.indexOf(id);
          const currentOrder = PLAN_ORDER.indexOf(currentPlan);
          return (
            <Card
              key={id}
              className={cn(
                "flex flex-col p-5",
                isCurrent && "ring-1 ring-primary"
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{plan.name}</h3>
                {isCurrent && <Badge>Current</Badge>}
              </div>
              <p className="mt-2 text-2xl font-bold">
                ${plan.priceMonthly}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.highlights.slice(0, 4).map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {h}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : id === "free" ? (
                  <Button variant="outline" className="w-full" onClick={manage} disabled={pending || !stripeConfigured}>
                    Downgrade
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => upgrade(id)}
                    disabled={pending || !stripeConfigured}
                  >
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {order > currentOrder ? "Upgrade" : "Switch"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
