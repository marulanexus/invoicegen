"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/money";

/**
 * Public invoice page: the payer uploads their EFT proof of payment (PDF or
 * photo). The business checks it and records the payment.
 */
export function ProofUpload({ token, balance, currency }: { token: string; balance: number; currency: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose the proof of payment file first.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is too big (5 MB max). A screenshot works fine.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("amount", amount.replace(",", "."));
      body.append("paidOn", paidOn);
      body.append("reference", reference);
      const res = await fetch(`/api/public/${token}/proof`, { method: "POST", body });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Upload failed. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="mb-6 flex items-start gap-3 rounded-xl border bg-background p-4 text-sm sm:p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
        <p>
          <strong>Thanks, your proof of payment was sent.</strong> The business will check it and mark this invoice as
          paid.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border bg-background p-4 sm:p-5">
      <h2 className="font-semibold">Paid by EFT? Send your proof of payment</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Upload the PDF or a screenshot from your banking app. Amount due{" "}
        <strong className="text-foreground">{formatCurrency(balance, currency)}</strong>.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pop-file">Proof of payment</Label>
          <input
            ref={fileRef}
            id="pop-file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          <Button type="button" variant="outline" className="w-full justify-start" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            <span className="truncate">{fileName ?? "Choose a PDF or photo"}</span>
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pop-amount">Amount paid ({currency})</Label>
          <Input id="pop-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pop-date">Date paid</Label>
          <Input id="pop-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pop-ref">Payment reference (optional)</Label>
          <Input id="pop-ref" value={reference} maxLength={100} onChange={(e) => setReference(e.target.value)} placeholder="As it appears on the proof" />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button className="mt-4 w-full sm:w-auto" onClick={submit} disabled={busy}>
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Send proof of payment
      </Button>
    </section>
  );
}
