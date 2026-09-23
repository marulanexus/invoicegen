"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SelectField, SwitchField, TextAreaField, TextField } from "@/components/form/fields";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { DOCUMENT_TEMPLATES } from "@/lib/templates";
import { LogoUpload } from "@/components/settings/logo-upload";
import { updateBusinessProfile } from "@/server/settings/actions";
import type { BusinessProfile } from "@/server/db/schema";

export function BusinessProfileForm({ profile }: { profile: BusinessProfile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [form, setForm] = useState({
    displayName: profile.displayName ?? "",
    legalName: profile.legalName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    website: profile.website ?? "",
    logoUrl: profile.logoUrl ?? "",
    brandColor: profile.brandColor ?? "#2563eb",
    defaultTemplateKey: profile.defaultTemplateKey ?? "classic",
    addressLine1: profile.addressLine1 ?? "",
    addressLine2: profile.addressLine2 ?? "",
    city: profile.city ?? "",
    state: profile.state ?? "",
    postalCode: profile.postalCode ?? "",
    country: profile.country ?? "",
    taxId: profile.taxId ?? "",
    taxLabel: profile.taxLabel ?? "Tax",
    defaultTaxRate: profile.defaultTaxRate ?? "0",
    taxInclusive: profile.taxInclusive ?? false,
    defaultCurrency: profile.defaultCurrency ?? "USD",
    paymentTermsDays: String(profile.paymentTermsDays ?? 14),
    invoicePrefix: profile.invoicePrefix ?? "INV-",
    quotePrefix: profile.quotePrefix ?? "QUO-",
    receiptPrefix: profile.receiptPrefix ?? "REC-",
    defaultNotes: profile.defaultNotes ?? "",
    defaultTerms: profile.defaultTerms ?? "",
  });
  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));
  const err = (k: string) => errors[k]?.[0];

  function save() {
    setErrors({});
    startTransition(async () => {
      const res = await updateBusinessProfile({
        ...form,
        defaultTaxRate: Number(form.defaultTaxRate || 0),
        paymentTermsDays: Number(form.paymentTermsDays || 0),
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not save");
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">Identity</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Business name" required value={form.displayName} onValueChange={(v) => set("displayName", v)} error={err("displayName")} />
            <TextField label="Legal name" value={form.legalName} onValueChange={(v) => set("legalName", v)} />
            <TextField label="Billing email" type="email" value={form.email} onValueChange={(v) => set("email", v)} error={err("email")} />
            <TextField label="Phone" value={form.phone} onValueChange={(v) => set("phone", v)} />
            <TextField label="Website" value={form.website} onValueChange={(v) => set("website", v)} />
            <div className="space-y-1.5">
              <Label>Brand color</Label>
              <input type="color" aria-label="Brand color" value={form.brandColor} onChange={(e) => set("brandColor", e.target.value)} className="h-9 w-16 cursor-pointer rounded-md border bg-transparent" />
            </div>
          </div>
          <LogoUpload value={form.logoUrl} onChange={(v) => set("logoUrl", v)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Default document template"
              value={form.defaultTemplateKey}
              onValueChange={(v) => set("defaultTemplateKey", v)}
              options={DOCUMENT_TEMPLATES.map((t) => ({ value: t.key, label: t.name }))}
              hint="Applied to new invoices, quotes & receipts"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">Address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Address line 1" value={form.addressLine1} onValueChange={(v) => set("addressLine1", v)} />
            <TextField label="Address line 2" value={form.addressLine2} onValueChange={(v) => set("addressLine2", v)} />
            <TextField label="City" value={form.city} onValueChange={(v) => set("city", v)} />
            <TextField label="State / Province" value={form.state} onValueChange={(v) => set("state", v)} />
            <TextField label="Postal code" value={form.postalCode} onValueChange={(v) => set("postalCode", v)} />
            <TextField label="Country" value={form.country} onValueChange={(v) => set("country", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">Tax, currency & numbering</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Default currency" value={form.defaultCurrency} onValueChange={(v) => set("defaultCurrency", v)} options={SUPPORTED_CURRENCIES.map((c) => ({ value: c.code, label: c.code }))} />
            <TextField label="Tax label" value={form.taxLabel} onValueChange={(v) => set("taxLabel", v)} />
            <TextField label="Default tax %" type="number" value={String(form.defaultTaxRate)} onValueChange={(v) => set("defaultTaxRate", v)} />
            <TextField label="Tax ID / VAT" value={form.taxId} onValueChange={(v) => set("taxId", v)} />
            <TextField label="Payment terms (days)" type="number" value={form.paymentTermsDays} onValueChange={(v) => set("paymentTermsDays", v)} />
          </div>
          <SwitchField label="Prices include tax" checked={Boolean(form.taxInclusive)} onCheckedChange={(v) => set("taxInclusive", v)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Invoice prefix" value={form.invoicePrefix} onValueChange={(v) => set("invoicePrefix", v)} />
            <TextField label="Quote prefix" value={form.quotePrefix} onValueChange={(v) => set("quotePrefix", v)} />
            <TextField label="Receipt prefix" value={form.receiptPrefix} onValueChange={(v) => set("receiptPrefix", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">Document defaults</h2>
          <TextAreaField label="Default notes" value={form.defaultNotes} onValueChange={(v) => set("defaultNotes", v)} />
          <TextAreaField label="Default terms" value={form.defaultTerms} onValueChange={(v) => set("defaultTerms", v)} />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
