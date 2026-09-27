"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectField, TextField } from "@/components/form/fields";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { acceptProof, proofFileUrl, rejectProof } from "@/server/proofs/actions";
import type { PaymentProof } from "@/server/db/schema";

const STATUS = {
  pending: { label: "To check", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  rejected: { label: "Rejected", variant: "secondary" },
} as const;

/** Owner review of proofs of payment uploaded on the invoice link. */
export function ProofReview({
  documentId,
  proofs,
  balance,
  currency,
}: {
  documentId: string;
  proofs: PaymentProof[];
  balance: number;
  currency: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [accepting, setAccepting] = useState<PaymentProof | null>(null);
  const [rejecting, setRejecting] = useState<PaymentProof | null>(null);
  const [form, setForm] = useState({ amount: "", paidAt: "", method: "bank_transfer", reference: "" });
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  if (proofs.length === 0) return null;

  function view(p: PaymentProof) {
    // Open now (a user click), fill in once the signed link arrives.
    const tab = window.open("about:blank", "_blank");
    startTransition(async () => {
      const res = await proofFileUrl(p.id);
      if (!res.ok) {
        tab?.close();
        toast.error(res.error);
        return;
      }
      if (tab) {
        tab.opener = null;
        tab.location.href = res.url;
      } else {
        window.location.href = res.url;
      }
    });
  }

  function openAccept(p: PaymentProof) {
    setErrors({});
    setForm({
      amount: String(p.amount ? Math.min(Number(p.amount), balance) : balance),
      paidAt: p.paidOn ?? new Date().toISOString().slice(0, 10),
      method: "bank_transfer",
      reference: p.reference ?? "",
    });
    setAccepting(p);
  }

  function accept() {
    if (!accepting) return;
    startTransition(async () => {
      const res = await acceptProof(accepting.id, documentId, {
        amount: Number(form.amount.replace(",", ".")),
        paidAt: form.paidAt,
        method: form.method,
        reference: form.reference || undefined,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not record the payment");
        return;
      }
      toast.success("Payment recorded");
      setAccepting(null);
      router.refresh();
    });
  }

  function reject() {
    if (!rejecting) return;
    startTransition(async () => {
      const res = await rejectProof(rejecting.id, documentId, { reason });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not reject");
        return;
      }
      toast.success("Proof rejected");
      setRejecting(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proof of payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {proofs.map((p) => (
          <div key={p.id} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {p.amount ? formatCurrency(p.amount, currency) : "Amount not given"}
              </span>
              <Badge variant={STATUS[p.status].variant}>{STATUS[p.status].label}</Badge>
            </div>
            <p className="text-muted-foreground">
              {[p.paidOn ? `Paid ${formatDate(p.paidOn)}` : null, p.reference ? `Ref ${p.reference}` : null, `Sent ${formatDate(p.createdAt)}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {p.note && <p className="text-muted-foreground">“{p.note}”</p>}
            {p.status === "rejected" && p.rejectionReason && (
              <p className="text-muted-foreground">Rejected: {p.rejectionReason}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => view(p)} disabled={pending}>
                <Eye className="h-4 w-4" /> View
              </Button>
              {p.status === "pending" && (
                <>
                  <Button size="sm" onClick={() => openAccept(p)} disabled={pending || balance <= 0}>
                    <Check className="h-4 w-4" /> Accept
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setRejecting(p)} disabled={pending}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={accepting !== null} onOpenChange={(o) => !o && setAccepting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record this payment</DialogTitle>
            <DialogDescription>
              Check the amount against your bank statement. Balance due: {formatCurrency(balance, currency)}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={`Amount (${currency})`} type="number" value={form.amount} onValueChange={(v) => setForm({ ...form, amount: v })} error={errors.amount?.[0]} />
            <TextField label="Date paid" type="date" value={form.paidAt} onValueChange={(v) => setForm({ ...form, paidAt: v })} error={errors.paidAt?.[0]} />
            <SelectField
              label="Method"
              value={form.method}
              onValueChange={(v) => setForm({ ...form, method: v })}
              options={[
                { value: "bank_transfer", label: "EFT / bank transfer" },
                { value: "cash", label: "Cash" },
                { value: "card", label: "Card" },
                { value: "other", label: "Other" },
              ]}
            />
            <TextField label="Reference" value={form.reference} onValueChange={(v) => setForm({ ...form, reference: v })} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAccepting(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={accept} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this proof?</DialogTitle>
            <DialogDescription>For example: the money hasn&apos;t arrived, or it&apos;s for a different invoice.</DialogDescription>
          </DialogHeader>
          <TextField label="Reason" value={reason} onValueChange={setReason} error={errors.reason?.[0]} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reject} disabled={pending || reason.trim().length < 3}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
