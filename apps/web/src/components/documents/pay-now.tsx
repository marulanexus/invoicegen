"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/money";

type Provider = "payfast" | "yoco";

const LABEL: Record<Provider, { title: string; detail: string }> = {
  payfast: { title: "Pay with PayFast", detail: "EFT, card, SnapScan, Zapper and more" },
  yoco: { title: "Pay by card", detail: "Card, Apple Pay, Google Pay (Yoco)" },
};

type Start =
  | { kind: "redirect"; url: string }
  | { kind: "form"; action: string; fields: [string, string][] };

/** Send the browser to the provider: a redirect (Yoco) or a signed form post (PayFast). */
function go(start: Start) {
  if (start.kind === "redirect") {
    window.location.assign(start.url);
    return;
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = start.action;
  for (const [name, value] of start.fields) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function PayNow({
  token,
  providers,
  balance,
  currency,
}: {
  token: string;
  providers: Provider[];
  balance: number;
  currency: string;
}) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(provider: Provider) {
    setBusy(provider);
    setError(null);
    try {
      const res = await fetch(`/api/public/${token}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Payment couldn't be started. Please try again.");
        setBusy(null);
        return;
      }
      go(json.data as Start); // leaves the page; keep the spinner
    } catch {
      setError("Payment couldn't be started. Check your connection and try again.");
      setBusy(null);
    }
  }

  return (
    <section className="mb-6 rounded-xl border bg-background p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <CreditCard className="h-4 w-4" /> Pay this invoice online
        </h2>
        <span className="text-sm text-muted-foreground">
          Amount due <strong className="text-foreground">{formatCurrency(balance, currency)}</strong>
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {providers.map((p) => (
          <Button
            key={p}
            size="lg"
            variant={p === providers[0] ? "default" : "outline"}
            className="h-auto flex-col items-start gap-0.5 py-3 text-left"
            disabled={busy !== null}
            onClick={() => pay(p)}
          >
            <span className="flex items-center gap-2">
              {busy === p && <Loader2 className="h-4 w-4 animate-spin" />}
              {LABEL[p].title}
            </span>
            <span className="text-xs font-normal opacity-80">{LABEL[p].detail}</span>
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
