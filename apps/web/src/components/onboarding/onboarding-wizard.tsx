"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  SelectField,
  SwitchField,
  TextAreaField,
  TextField,
} from "@/components/form/fields";
import { cn } from "@/lib/utils";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { isSouthAfrica, ZA_VAT_RATE } from "@invoicegen/shared/tax-invoice";
import { completeOnboarding } from "@/server/onboarding/actions";

type FormState = {
  displayName: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
  brandColor: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  defaultCurrency: string;
  taxLabel: string;
  defaultTaxRate: string;
  taxInclusive: boolean;
  vatRegistered: boolean;
  taxId: string;
  paymentTermsDays: string;
  invoicePrefix: string;
  quotePrefix: string;
  receiptPrefix: string;
  defaultNotes: string;
  defaultTerms: string;
};

const STEPS = ["Business", "Address", "Financial", "Finish"] as const;

export function OnboardingWizard({
  defaults,
}: {
  defaults: { displayName: string; email: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [form, setForm] = useState<FormState>({
    displayName: defaults.displayName,
    legalName: "",
    email: defaults.email,
    phone: "",
    website: "",
    logoUrl: "",
    brandColor: "#2563eb",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    defaultCurrency: "USD",
    taxLabel: "Tax",
    defaultTaxRate: "0",
    taxInclusive: false,
    vatRegistered: false,
    taxId: "",
    paymentTermsDays: "14",
    invoicePrefix: "INV-",
    quotePrefix: "QUO-",
    receiptPrefix: "REC-",
    defaultNotes: "Thank you for your business!",
    defaultTerms: "",
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const err = (key: string) => errors[key]?.[0];

  function next() {
    if (step === 0 && !form.displayName.trim()) {
      setErrors({ displayName: ["Business name is required"] });
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  function submit() {
    startTransition(async () => {
      const res = await completeOnboarding({
        ...form,
        defaultTaxRate: Number(form.defaultTaxRate || 0),
        paymentTermsDays: Number(form.paymentTermsDays || 0),
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Something went wrong");
        // Jump back to the first step that has an error.
        if (res.fieldErrors?.displayName) setStep(0);
        else if (res.fieldErrors?.taxId || res.fieldErrors?.defaultTaxRate) setStep(2);
        return;
      }
      toast.success("You're all set! Welcome to InvoiceGen.");
      router.push("/dashboard");
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Logo href={null} />
        <span className="text-sm text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>

      {/* Stepper */}
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                i < step && "border-primary bg-primary text-primary-foreground",
                i === step && "border-primary text-primary",
                i > step && "text-muted-foreground"
              )}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-sm sm:inline",
                i === step ? "font-medium" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 hidden h-px flex-1 bg-border sm:block" />
            )}
          </li>
        ))}
      </ol>

      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        {step === 0 && (
          <div className="space-y-5">
            <Header
              title="Tell us about your business"
              subtitle="This appears on every invoice you send."
            />
            <TextField
              label="Business / brand name"
              required
              value={form.displayName}
              onValueChange={(v) => set("displayName", v)}
              error={err("displayName")}
              placeholder="Northwind Studio"
            />
            <TextField
              label="Legal name (optional)"
              value={form.legalName}
              onValueChange={(v) => set("legalName", v)}
              placeholder="Northwind Studio LLC"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Billing email"
                type="email"
                value={form.email}
                onValueChange={(v) => set("email", v)}
                error={err("email")}
                placeholder="billing@northwind.studio"
              />
              <TextField
                label="Phone"
                value={form.phone}
                onValueChange={(v) => set("phone", v)}
                placeholder="+1 (415) 555-0142"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Website"
                value={form.website}
                onValueChange={(v) => set("website", v)}
                placeholder="https://northwind.studio"
              />
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <TextField
                  label="Logo URL"
                  value={form.logoUrl}
                  onValueChange={(v) => set("logoUrl", v)}
                  hint="Paste a hosted image URL"
                  placeholder="https://…/logo.png"
                />
                <input
                  type="color"
                  aria-label="Brand color"
                  value={form.brandColor}
                  onChange={(e) => set("brandColor", e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border bg-transparent"
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <Header
              title="Business address"
              subtitle="Shown in the “From” block on documents."
            />
            <TextField
              label="Address line 1"
              value={form.addressLine1}
              onValueChange={(v) => set("addressLine1", v)}
              placeholder="2100 Market Street"
            />
            <TextField
              label="Address line 2"
              value={form.addressLine2}
              onValueChange={(v) => set("addressLine2", v)}
              placeholder="Suite 300"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="City" value={form.city} onValueChange={(v) => set("city", v)} />
              <TextField label="State / Province" value={form.state} onValueChange={(v) => set("state", v)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Postal code" value={form.postalCode} onValueChange={(v) => set("postalCode", v)} />
              <TextField label="Country" value={form.country} onValueChange={(v) => set("country", v)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <Header
              title="Currency, tax & numbering"
              subtitle="Smart defaults you can override per client or document."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Default currency"
                value={form.defaultCurrency}
                onValueChange={(v) => set("defaultCurrency", v)}
                options={SUPPORTED_CURRENCIES.map((c) => ({
                  value: c.code,
                  label: `${c.code} — ${c.label}`,
                }))}
              />
              <TextField
                label="Payment terms (days)"
                type="number"
                value={form.paymentTermsDays}
                onValueChange={(v) => set("paymentTermsDays", v)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Tax label" value={form.taxLabel} onValueChange={(v) => set("taxLabel", v)} hint="e.g. VAT, GST, Sales Tax" />
              <TextField
                label="Default tax rate (%)"
                type="number"
                value={form.defaultTaxRate}
                onValueChange={(v) => set("defaultTaxRate", v)}
                error={err("defaultTaxRate")}
              />
            </div>
            <SwitchField
              label="Registered for VAT"
              description={
                isSouthAfrica(form.country)
                  ? "Only VAT vendors may charge VAT. Your invoices become SARS tax invoices showing your VAT number."
                  : "Turn on if you're registered to charge VAT or sales tax."
              }
              checked={form.vatRegistered}
              onCheckedChange={(on) =>
                setForm((f) => ({
                  ...f,
                  vatRegistered: on,
                  ...(isSouthAfrica(f.country)
                    ? on
                      ? { taxLabel: "VAT", defaultTaxRate: String(ZA_VAT_RATE) }
                      : { defaultTaxRate: "0" }
                    : {}),
                }))
              }
            />
            {form.vatRegistered && (
              <TextField
                label="VAT number"
                value={form.taxId}
                onValueChange={(v) => set("taxId", v)}
                error={err("taxId")}
                hint={isSouthAfrica(form.country) ? "10 digits starting with 4, as on your SARS VAT registration" : undefined}
              />
            )}
            <SwitchField
              label="Prices include tax"
              description="Turn on if your line item prices are tax-inclusive."
              checked={form.taxInclusive}
              onCheckedChange={(v) => set("taxInclusive", v)}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Invoice prefix" value={form.invoicePrefix} onValueChange={(v) => set("invoicePrefix", v)} />
              <TextField label="Quote prefix" value={form.quotePrefix} onValueChange={(v) => set("quotePrefix", v)} />
              <TextField label="Receipt prefix" value={form.receiptPrefix} onValueChange={(v) => set("receiptPrefix", v)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <Header
              title="Default notes & terms"
              subtitle="Pre-filled on new documents — edit anytime."
            />
            <TextAreaField
              label="Default notes"
              value={form.defaultNotes}
              onValueChange={(v) => set("defaultNotes", v)}
              placeholder="Thank you for your business!"
            />
            <TextAreaField
              label="Default terms & conditions"
              value={form.defaultTerms}
              onValueChange={(v) => set("defaultTerms", v)}
              placeholder="Payment due within 14 days…"
            />
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{form.displayName || "Your business"}</p>
              <p className="text-muted-foreground">
                {[form.city, form.country].filter(Boolean).join(", ") || "Address pending"} ·{" "}
                {form.defaultCurrency} · {form.taxLabel} {form.defaultTaxRate}%
              </p>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="mt-8 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 0 || pending}
            className={cn(step === 0 && "invisible")}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} disabled={pending}>
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Finish setup
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
