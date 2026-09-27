"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
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
import { recordRefund } from "@/server/payments/actions";

const METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

/** Record money paid back to the client when an invoice is overpaid or cancelled. */
export function RecordRefundDialog({
  documentId,
  refundDue,
  currency,
}: {
  documentId: string;
  refundDue: number;
  currency: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [amount, setAmount] = useState(String(refundDue));
  const [method, setMethod] = useState("bank_transfer");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  function onOpenChange(next: boolean) {
    if (next) {
      setErrors({});
      setAmount(String(refundDue));
    }
    setOpen(next);
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const res = await recordRefund({
        documentId,
        amount: Number(amount.replace(",", ".")),
        method,
        paidAt,
        reference,
        notes,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not record the refund");
        return;
      }
      toast.success("Refund recorded");
      setOpen(false);
      setReference("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Undo2 className="h-4 w-4" /> Record refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a refund</DialogTitle>
          <DialogDescription>
            Log money you paid back to the client. Refund due: {formatCurrency(refundDue, currency)}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={`Amount (${currency})`}
              type="number"
              value={amount}
              onValueChange={setAmount}
              error={errors.amount?.[0]}
            />
            <TextField label="Date refunded" type="date" value={paidAt} onValueChange={setPaidAt} error={errors.paidAt?.[0]} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Method" value={method} onValueChange={setMethod} options={METHODS} />
            <TextField label="Reference" value={reference} onValueChange={setReference} placeholder="e.g. EFT reference" />
          </div>
          <TextAreaField label="Notes" value={notes} onValueChange={setNotes} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
