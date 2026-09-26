"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Repeat } from "lucide-react";
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
import { SelectField, TextField } from "@/components/form/fields";
import { createRecurringFromInvoice } from "@/server/documents/recurring-actions";

export function RecurringDialog({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [frequency, setFrequency] = useState("monthly");
  const [interval, setInterval] = useState("1");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState("");

  function submit() {
    startTransition(async () => {
      const res = await createRecurringFromInvoice({
        invoiceId,
        frequency: frequency as "weekly" | "monthly" | "quarterly" | "yearly",
        interval: Number(interval || 1),
        startDate,
        endDate: endDate || null,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Could not schedule");
        return;
      }
      toast.success("Recurring schedule created");
      setOpen(false);
      router.push("/invoices/recurring");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Repeat className="h-4 w-4" /> Make recurring
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule recurring invoice</DialogTitle>
          <DialogDescription>
            We&apos;ll automatically generate a draft invoice from this one on
            your chosen cadence.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Frequency"
              value={frequency}
              onValueChange={setFrequency}
              options={[
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
                { value: "yearly", label: "Yearly" },
              ]}
            />
            <TextField
              label="Every (interval)"
              type="number"
              value={interval}
              onValueChange={setInterval}
              hint="e.g. 2 = every 2 months"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="First run" type="date" value={startDate} onValueChange={setStartDate} />
            <TextField label="End date (optional)" type="date" value={endDate} onValueChange={setEndDate} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
