"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileMinus, FilePlus, Loader2 } from "lucide-react";
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
import { issueNote } from "@/server/documents/actions";

/**
 * Issue a credit note (reduce/cancel) or debit note (add to) an issued
 * invoice. Amounts include VAT; the note says why (VAT Act s21(3)).
 */
export function NoteDialog({
  kind,
  invoiceId,
  invoiceNumber,
  remaining,
  currency,
  taxLabel,
}: {
  kind: "credit" | "debit";
  invoiceId: string;
  invoiceNumber: string;
  /** Invoice total after earlier notes: the most that can be credited. */
  remaining: number;
  currency: string;
  taxLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [mode, setMode] = useState<"full" | "amount">(kind === "credit" ? "full" : "amount");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const isCredit = kind === "credit";
  const label = isCredit ? "Credit note" : "Debit note";

  function submit() {
    setErrors({});
    startTransition(async () => {
      const res = await issueNote(invoiceId, {
        kind,
        reason,
        mode,
        amount: mode === "amount" ? Number(amount.replace(",", ".")) : undefined,
        description: description || undefined,
      });
      if (!res.ok || !res.id) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? `Could not issue the ${label.toLowerCase()}`);
        return;
      }
      toast.success(`${label} issued`);
      setOpen(false);
      router.push(`/documents/${res.id}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          {isCredit ? <FileMinus className="h-4 w-4" /> : <FilePlus className="h-4 w-4" />}
          {isCredit ? "Issue credit note" : "Issue debit note"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {label} for {invoiceNumber}
          </DialogTitle>
          <DialogDescription>
            {isCredit
              ? `Reduces or cancels ${invoiceNumber} without changing the issued invoice. Up to ${formatCurrency(remaining, currency)} can be credited.`
              : `Adds an amount to ${invoiceNumber}, for example an extra charge that was left off.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isCredit && (
            <SelectField
              label="Credit"
              value={mode}
              onValueChange={(v) => setMode(v as "full" | "amount")}
              options={[
                { value: "full", label: `Everything: cancel the invoice (${formatCurrency(remaining, currency)})` },
                { value: "amount", label: "Part of it" },
              ]}
            />
          )}
          {mode === "amount" && (
            <>
              <TextField
                label={`Amount incl. ${taxLabel} (${currency})`}
                type="number"
                value={amount}
                onValueChange={setAmount}
                error={errors.amount?.[0]}
              />
              <TextField
                label="Description (optional)"
                value={description}
                onValueChange={setDescription}
                placeholder={isCredit ? "e.g. Discount on logo design" : "e.g. Extra revision round"}
              />
            </>
          )}
          <TextAreaField
            label="Reason (shown on the note)"
            value={reason}
            onValueChange={setReason}
            error={errors.reason?.[0]}
            placeholder={isCredit ? "e.g. Client returned one item; agreed discount" : "e.g. Undercharged on the original invoice"}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || reason.trim().length < 3}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Issue {label.toLowerCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
