"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SelectField, TextAreaField, TextField } from "@/components/form/fields";
import { formatCurrency } from "@/lib/money";
import { recordPayment } from "@/server/payments/actions";

export interface OpenInvoiceOption {
  id: string;
  number: string;
  balance: number;
  currency: string;
}

const METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Other" },
];

export function RecordPaymentDialog({
  invoices,
  triggerLabel = "Record payment",
  defaultDocumentId,
}: {
  invoices: OpenInvoiceOption[];
  triggerLabel?: string;
  defaultDocumentId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [documentId, setDocumentId] = useState(
    defaultDocumentId ?? invoices[0]?.id ?? ""
  );
  const selected = invoices.find((i) => i.id === documentId);
  const [amount, setAmount] = useState(String(selected?.balance ?? ""));
  const [method, setMethod] = useState("bank_transfer");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function onPickInvoice(id: string) {
    setDocumentId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) setAmount(String(inv.balance));
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const res = await recordPayment({
        documentId,
        amount: Number(amount),
        method,
        paidAt,
        reference,
        notes,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not record payment");
        return;
      }
      toast.success("Payment recorded");
      setOpen(false);
      setReference("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={invoices.length === 0}>
          <Plus className="h-4 w-4" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Log a payment received against an invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <SelectField
            label="Invoice"
            value={documentId}
            onValueChange={onPickInvoice}
            options={invoices.map((i) => ({
              value: i.id,
              label: `${i.number} — ${formatCurrency(i.balance, i.currency)} due`,
            }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Amount"
              type="number"
              value={amount}
              onValueChange={setAmount}
              error={errors.amount?.[0]}
            />
            <TextField
              label="Date"
              type="date"
              value={paidAt}
              onValueChange={setPaidAt}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Method"
              value={method}
              onValueChange={setMethod}
              options={METHODS}
            />
            <TextField
              label="Reference"
              value={reference}
              onValueChange={setReference}
              placeholder="e.g. transfer #"
            />
          </div>
          <TextAreaField label="Notes" value={notes} onValueChange={setNotes} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || !documentId}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
