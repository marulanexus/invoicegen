"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField, TextAreaField, TextField } from "@/components/form/fields";
import { Badge } from "@/components/ui/badge";
import { SUPPORTED_CURRENCIES } from "@/lib/money";
import { createClient, updateClient } from "@/server/clients/actions";
import type { Client } from "@/server/db/schema";

export function ClientForm({ client }: { client?: Client }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [tagDraft, setTagDraft] = useState("");

  const [form, setForm] = useState({
    name: client?.name ?? "",
    companyName: client?.companyName ?? "",
    contactName: client?.contactName ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    website: client?.website ?? "",
    addressLine1: client?.addressLine1 ?? "",
    addressLine2: client?.addressLine2 ?? "",
    city: client?.city ?? "",
    state: client?.state ?? "",
    postalCode: client?.postalCode ?? "",
    country: client?.country ?? "",
    taxId: client?.taxId ?? "",
    currency: client?.currency ?? "",
    taxRate: client?.taxRate ?? "",
    notes: client?.notes ?? "",
  });
  const [tags, setTags] = useState<string[]>(client?.tags ?? []);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const err = (k: string) => errors[k]?.[0];

  function addTag() {
    const t = tagDraft.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagDraft("");
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const payload = {
        ...form,
        taxRate: form.taxRate === "" ? undefined : Number(form.taxRate),
        currency: form.currency || undefined,
        tags,
      };
      const res = client
        ? await updateClient(client.id, payload)
        : await createClient(payload);

      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not save client");
        return;
      }
      toast.success(client ? "Client updated" : "Client added");
      router.push(res.id ? `/clients/${res.id}` : "/clients");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Display name"
              required
              value={form.name}
              onValueChange={(v) => set("name", v)}
              error={err("name")}
              placeholder="Acme Corporation"
            />
            <TextField
              label="Company name"
              value={form.companyName}
              onValueChange={(v) => set("companyName", v)}
            />
            <TextField
              label="Contact person"
              value={form.contactName}
              onValueChange={(v) => set("contactName", v)}
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onValueChange={(v) => set("email", v)}
              error={err("email")}
            />
            <TextField label="Phone" value={form.phone} onValueChange={(v) => set("phone", v)} />
            <TextField label="Website" value={form.website} onValueChange={(v) => set("website", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 pt-6">
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
        <CardContent className="space-y-5 pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Billing & notes
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Currency override"
              value={form.currency || "__default"}
              onValueChange={(v) => set("currency", v === "__default" ? "" : v)}
              options={[
                { value: "__default", label: "Use business default" },
                ...SUPPORTED_CURRENCIES.map((c) => ({
                  value: c.code,
                  label: `${c.code} — ${c.label}`,
                })),
              ]}
            />
            <TextField
              label="Tax rate override (%)"
              type="number"
              value={String(form.taxRate)}
              onValueChange={(v) => set("taxRate", v)}
              hint="Leave blank to use default"
            />
            <TextField label="Tax ID / VAT no." value={form.taxId} onValueChange={(v) => set("taxId", v)} />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  {t}
                  <button
                    type="button"
                    onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                    className="ml-0.5 rounded-full hover:text-destructive"
                    aria-label={`Remove ${t}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                onBlur={addTag}
                placeholder="Add tag…"
                className="h-7 w-32 border-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <TextAreaField label="Notes" value={form.notes} onValueChange={(v) => set("notes", v)} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {client ? "Save changes" : "Add client"}
        </Button>
      </div>
    </div>
  );
}
