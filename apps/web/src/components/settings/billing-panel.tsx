"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/money";
import { PLAN_ORDER, PLANS, type BillingInterval, type PlanId } from "@/lib/plans";
import {
  cancelSubscription,
  openBillingPortal,
  startCheckout,
  startPayfastCheckout,
} from "@/server/billing/actions";

export interface BillingHistoryRow {
  id: string;
  paidOn: string;
  plan: PlanId;
  interval: BillingInterval;
  amount: string;
  vatAmount: string;
  periodEnd: string;
}

/** Post the signed form to PayFast (a full-page navigation). */
function postToPayfast(action: string, fields: [string, string][]) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  for (const [name, value] of fields) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

/**
 * Plans and billing. Rand plans go through PayFast recurring billing when it's
 * configured; otherwise Stripe (USD), when that is.
 */
export function BillingPanel({
  currentPlan,
  provider,
  interval: currentInterval,
  renewsOn,
  cancelling,
  subscribedWith,
  vatRegistered,
  history,
}: {
  currentPlan: PlanId;
  /** How this deployment charges: rand via PayFast, USD via Stripe, or not at all. */
  provider: "payfast" | "stripe" | null;
  interval: BillingInterval | null;
  renewsOn?: string | null;
  /** Cancelled: the plan ends on `renewsOn`. */
  cancelling: boolean;
  subscribedWith: "payfast" | "stripe" | null;
  vatRegistered: boolean;
  history: BillingHistoryRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [interval, setInterval] = useState<BillingInterval>(currentInterval ?? "monthly");
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Rand unless this deployment bills in USD through Stripe (South Africa first).
  const zar = provider !== "stripe";
  const paid = currentPlan !== "free";

  function choose(plan: PlanId) {
    startTransition(async () => {
      if (provider === "payfast") {
        const res = await startPayfastCheckout(plan, interval);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        postToPayfast(res.action, res.fields);
        return;
      }
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

  function cancel() {
    startTransition(async () => {
      const res = await cancelSubscription();
      if (!res.ok) {
        toast.error(res.error ?? "Could not cancel");
        return;
      }
      toast.success("Subscription cancelled");
      setConfirmCancel(false);
      router.refresh();
    });
  }

  const payfastSub = subscribedWith === "payfast";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-lg font-semibold">
              {PLANS[currentPlan].name}{" "}
              {paid && (cancelling ? <Badge variant="warning">Cancelled</Badge> : <Badge variant="success">Active</Badge>)}
            </p>
            {paid && renewsOn && (
              <p className="text-xs text-muted-foreground">
                {cancelling
                  ? `Ends ${renewsOn}, then you're on Free Starter`
                  : `Renews ${renewsOn}${currentInterval ? ` · billed ${currentInterval}` : ""}`}
              </p>
            )}
          </div>
          {paid && payfastSub && !cancelling && (
            <Button variant="outline" onClick={() => setConfirmCancel(true)} disabled={pending}>
              Cancel subscription
            </Button>
          )}
          {paid && subscribedWith === "stripe" && provider === "stripe" && (
            <Button variant="outline" onClick={manage} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Manage billing
            </Button>
          )}
        </CardContent>
      </Card>

      {!provider && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          Billing is not configured on this deployment. Add the PayFast billing merchant details (
          <code className="font-mono">PAYFAST_BILLING_*</code>) to <code className="font-mono">.env.local</code> to
          enable paid plans in rand.
        </div>
      )}

      {zar && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border p-1" role="group" aria-label="Billing period">
            {(["monthly", "yearly"] as const).map((i) => (
              <Button
                key={i}
                size="sm"
                variant={interval === i ? "default" : "ghost"}
                aria-pressed={interval === i}
                onClick={() => setInterval(i)}
              >
                {i === "monthly" ? "Monthly" : "Yearly"}
              </Button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">Yearly: 2 months free</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const isCurrent = id === currentPlan && (!zar || id === "free" || interval === currentInterval);
          const order = PLAN_ORDER.indexOf(id);
          const currentOrder = PLAN_ORDER.indexOf(currentPlan);
          const price = zar ? plan.zar[interval] : plan.priceMonthly;
          return (
            <Card key={id} className={cn("flex flex-col p-5", id === currentPlan && "ring-1 ring-primary")}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{plan.name}</h3>
                {id === currentPlan && <Badge>Current</Badge>}
              </div>
              <p className="mt-2 text-2xl font-bold">
                {zar ? formatCurrency(price, "ZAR").replace(/[,.]00$/, "") : `$${price}`}
                <span className="text-sm font-normal text-muted-foreground">
                  {price === 0 ? "" : zar && interval === "yearly" ? "/yr" : "/mo"}
                </span>
              </p>
              {zar && vatRegistered && price > 0 && <p className="text-xs text-muted-foreground">incl. VAT</p>}
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {plan.highlights.slice(0, 4).map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {h}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {isCurrent && !(zar && cancelling && id !== "free") ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : id === "free" ? (
                  zar ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setConfirmCancel(true)}
                      disabled={pending || !payfastSub || cancelling}
                    >
                      {cancelling ? "Switching at period end" : "Downgrade"}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={manage} disabled={pending || !provider}>
                      Downgrade
                    </Button>
                  )
                ) : (
                  <Button className="w-full" onClick={() => choose(id)} disabled={pending || !provider}>
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {id === currentPlan ? (cancelling ? "Resubscribe" : `Switch to ${interval}`) : order > currentOrder ? "Upgrade" : "Switch"}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {zar && (
        <p className="text-xs text-muted-foreground">
          Paid by card through PayFast and renewed automatically. Switching plans starts the new plan straight away and
          stops the old one. Cancel any time: you keep your plan until the end of the period you&apos;ve paid for.
        </p>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    {h.paidOn} · {PLANS[h.plan].name} ({h.interval})
                    <span className="block text-xs text-muted-foreground">Covers until {h.periodEnd}</span>
                  </span>
                  <span className="text-right font-medium">
                    {formatCurrency(h.amount, "ZAR")}
                    {Number(h.vatAmount) > 0 && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        incl. VAT {formatCurrency(h.vatAmount, "ZAR")}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your subscription?</DialogTitle>
            <DialogDescription>
              PayFast stops charging your card. You keep {PLANS[currentPlan].name}
              {renewsOn ? ` until ${renewsOn}` : " until the end of the period you've paid for"}, then move to Free
              Starter (3 clients, 5 documents a month). Your invoices and clients stay.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)} disabled={pending}>
              Keep my plan
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
