"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField, SwitchField, TextAreaField, TextField } from "@/components/form/fields";
import { DocumentPreview } from "@/components/documents/document-preview";
import { cn } from "@/lib/utils";
import { SUPPORTED_CURRENCIES, formatCurrency } from "@/lib/money";
import { documentHeading, viewLinesAndTotals, type DocumentView, type PartyView } from "@/lib/document-view";
import { taxInvoiceProblems } from "@invoicegen/shared/tax-invoice";
import { TaxInvoiceChecklist } from "@/components/documents/tax-invoice-checklist";
import { DOCUMENT_TEMPLATES } from "@/lib/templates";
import { createDocument, updateDocument } from "@/server/documents/actions";
import type { BusinessProfile, Client, Document, LineItem } from "@/server/db/schema";

type DocType = "invoice" | "quote" | "receipt";

interface LineState {
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
}

export interface DocumentBuilderProps {
  profile: BusinessProfile;
  clients: Client[];
  showPoweredBy: boolean;
  defaultType?: DocType;
  defaultClientId?: string;
  existing?: { document: Document; items: LineItem[] };
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DocumentBuilder({
  profile,
  clients,
  showPoweredBy,
  defaultType = "invoice",
  defaultClientId,
  existing,
}: DocumentBuilderProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const ex = existing?.document;
  const [type] = useState<DocType>((ex?.type as DocType) ?? defaultType);
  const [clientId, setClientId] = useState<string>(
    ex?.clientId ?? defaultClientId ?? ""
  );
  const [currency, setCurrency] = useState(ex?.currency ?? profile.defaultCurrency);
  const [issueDate, setIssueDate] = useState(ex?.issueDate ?? todayISO());
  const [dueDate, setDueDate] = useState(
    ex?.dueDate ?? addDaysISO(profile.paymentTermsDays ?? 14)
  );
  const [validUntil, setValidUntil] = useState(ex?.validUntil ?? addDaysISO(30));
  const [poNumber, setPoNumber] = useState(ex?.poNumber ?? "");
  const [templateKey, setTemplateKey] = useState(
    ex?.templateKey ?? profile.defaultTemplateKey ?? "classic"
  );
  const [accentColor, setAccentColor] = useState(
    ex?.accentColor ?? profile.brandColor ?? "#2563eb"
  );
  const [taxLabel, setTaxLabel] = useState(ex?.taxLabel ?? profile.taxLabel ?? "Tax");
  const [taxInclusive, setTaxInclusive] = useState(ex?.taxInclusive ?? false);
  const [notes, setNotes] = useState(ex?.notes ?? profile.defaultNotes ?? "");
  const [terms, setTerms] = useState(ex?.terms ?? profile.defaultTerms ?? "");

  const [lines, setLines] = useState<LineState[]>(
    existing?.items.length
      ? existing.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountRate: i.discountRate,
          taxRate: i.taxRate,
        }))
      : [
          {
            description: "",
            quantity: "1",
            unitPrice: "0",
            discountRate: "0",
            taxRate: String(profile.defaultTaxRate ?? 0),
          },
        ]
  );

  const selectedClient = clients.find((c) => c.id === clientId);

  function setLine(idx: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [
      ...prev,
      { description: "", quantity: "1", unitPrice: "0", discountRate: "0", taxRate: String(profile.defaultTaxRate ?? 0) },
    ]);
  }
  function removeLine(idx: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  // Build the live view shared with the PDF/detail renderer.
  const view: DocumentView = useMemo(() => {
    const { items, totals } = viewLinesAndTotals(lines, taxInclusive);
    const from: PartyView = {
      name: profile.displayName,
      lines: [
        profile.addressLine1,
        profile.addressLine2,
        [profile.city, profile.state].filter(Boolean).join(", "),
        profile.postalCode,
        profile.country,
      ].filter(Boolean) as string[],
      email: profile.email,
      phone: profile.phone,
      taxId: profile.taxId,
      vatRegistered: profile.vatRegistered,
    };
    const billTo: PartyView | null = selectedClient
      ? {
          name: selectedClient.name,
          lines: [
            selectedClient.companyName,
            selectedClient.addressLine1,
            [selectedClient.city, selectedClient.state].filter(Boolean).join(", "),
            selectedClient.postalCode,
            selectedClient.country,
          ].filter(Boolean) as string[],
          email: selectedClient.email,
          phone: selectedClient.phone,
          taxId: selectedClient.taxId,
        }
      : null;

    return {
      type,
      heading: documentHeading(type, profile.vatRegistered),
      number: ex?.number ?? `${prefixFor(type, profile)}…`,
      status: ex?.status,
      currency,
      issueDate,
      dueDate,
      validUntil,
      poNumber,
      from,
      billTo,
      logoUrl: profile.logoUrl,
      items,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      amountPaid: Number(ex?.amountPaid ?? 0),
      adjustmentTotal: Number(ex?.adjustmentTotal ?? 0),
      balanceDue: Math.max(totals.total + Number(ex?.adjustmentTotal ?? 0) - Number(ex?.amountPaid ?? 0), 0),
      taxLabel,
      taxInclusive,
      notes,
      terms,
      accentColor,
      templateKey,
      showPoweredBy,
    };
  }, [
    lines, taxInclusive, profile, selectedClient, type, ex, currency, issueDate,
    dueDate, validUntil, poNumber, taxLabel, notes, terms, accentColor,
    templateKey, showPoweredBy,
  ]);

  // Live SARS check against the details the invoice will be issued with.
  const taxProblems = useMemo(
    () =>
      taxInvoiceProblems({
        type,
        currency,
        total: view.total,
        taxTotal: view.taxTotal,
        lines: view.items.map((i) => ({ description: i.description, taxRate: i.taxRate })),
        supplier: {
          name: profile.displayName,
          address: view.from.lines.filter((l) => l !== profile.country),
          vatNumber: profile.taxId,
          country: profile.country,
          vatRegistered: profile.vatRegistered,
        },
        recipient: selectedClient
          ? {
              name: selectedClient.name,
              address: (view.billTo?.lines ?? []).filter((l) => l !== selectedClient.country && l !== selectedClient.companyName),
              vatNumber: selectedClient.taxId,
              country: selectedClient.country,
            }
          : null,
      }),
    [type, currency, view, profile, selectedClient]
  );

  function save() {
    setErrors({});
    const payload = {
      type,
      clientId: clientId || null,
      currency,
      issueDate,
      dueDate: type === "invoice" ? dueDate : null,
      validUntil: type === "quote" ? validUntil : null,
      poNumber,
      templateKey,
      accentColor,
      taxLabel,
      taxInclusive,
      notes,
      terms,
      lineItems: lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity || 0),
        unitPrice: Number(l.unitPrice || 0),
        discountRate: Number(l.discountRate || 0),
        taxRate: Number(l.taxRate || 0),
      })),
    };

    startTransition(async () => {
      const res = ex
        ? await updateDocument(ex.id, payload)
        : await createDocument(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error ?? "Could not save");
        return;
      }
      toast.success(ex ? "Saved" : "Document created");
      router.push(`/documents/${res.id}`);
      router.refresh();
    });
  }

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <div>
      {/* Mobile toggle */}
      <div className="mb-4 flex rounded-lg border bg-card p-1 lg:hidden">
        <ToggleBtn active={mobileView === "edit"} onClick={() => setMobileView("edit")} icon={Pencil}>
          Edit
        </ToggleBtn>
        <ToggleBtn active={mobileView === "preview"} onClick={() => setMobileView("preview")} icon={Eye}>
          Preview
        </ToggleBtn>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Editor */}
        <div className={cn("space-y-5", mobileView === "preview" && "hidden lg:block")}>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Client"
                  value={clientId || "__none"}
                  onValueChange={(v) => {
                    const id = v === "__none" ? "" : v;
                    setClientId(id);
                    const c = clients.find((x) => x.id === id);
                    if (c?.currency) setCurrency(c.currency);
                  }}
                  options={[
                    { value: "__none", label: "No client" },
                    ...clients.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <SelectField
                  label="Currency"
                  value={currency}
                  onValueChange={setCurrency}
                  options={SUPPORTED_CURRENCIES.map((c) => ({
                    value: c.code,
                    label: `${c.code} — ${c.symbol}`,
                  }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Issue date"
                  type="date"
                  value={issueDate}
                  onValueChange={setIssueDate}
                  error={errors.issueDate?.[0]}
                />
                {type === "invoice" && (
                  <TextField label="Due date" type="date" value={dueDate} onValueChange={setDueDate} />
                )}
                {type === "quote" && (
                  <TextField label="Valid until" type="date" value={validUntil} onValueChange={setValidUntil} />
                )}
              </div>
              {type === "invoice" && (
                <TextField label="PO number (optional)" value={poNumber} onValueChange={setPoNumber} />
              )}
            </CardContent>
          </Card>

          {/* Line items */}
          <Card>
            <CardContent className="pt-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground">Line items</h2>
                {errors.lineItems && (
                  <span className="text-xs text-destructive">{errors.lineItems[0]}</span>
                )}
              </div>
              <div className="space-y-3">
                {lines.map((line, idx) => {
                  const amount =
                    Number(line.quantity || 0) *
                    Number(line.unitPrice || 0) *
                    (1 - Number(line.discountRate || 0) / 100);
                  return (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="flex items-start gap-2">
                        <Input
                          aria-label="Description"
                          placeholder="Description"
                          value={line.description}
                          onChange={(e) => setLine(idx, { description: e.target.value })}
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(idx)}
                          disabled={lines.length === 1}
                          aria-label="Remove line"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <NumField label="Qty" value={line.quantity} onChange={(v) => setLine(idx, { quantity: v })} />
                        <NumField label="Rate" value={line.unitPrice} onChange={(v) => setLine(idx, { unitPrice: v })} />
                        <NumField label="Disc %" value={line.discountRate} onChange={(v) => setLine(idx, { discountRate: v })} />
                        <NumField label="Tax %" value={line.taxRate} onChange={(v) => setLine(idx, { taxRate: v })} />
                      </div>
                      <div className="mt-2 text-right text-sm">
                        <span className="text-muted-foreground">Amount: </span>
                        <span className="font-medium">{formatCurrency(amount, currency)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button variant="outline" size="sm" onClick={addLine} className="mt-3">
                <Plus className="h-4 w-4" /> Add line
              </Button>

              <SwitchField
                label="Prices include tax"
                checked={taxInclusive}
                onCheckedChange={setTaxInclusive}
              />
              <div className="mt-3">
                <TextField label="Tax label" value={taxLabel} onValueChange={setTaxLabel} />
              </div>
            </CardContent>
          </Card>

          {/* Template + notes */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label className="mb-2 block">Template</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {DOCUMENT_TEMPLATES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        setTemplateKey(t.key);
                        setAccentColor(t.accent);
                      }}
                      className={cn(
                        "rounded-lg border p-2 text-left text-xs transition-colors",
                        templateKey === t.key
                          ? "border-primary ring-1 ring-primary"
                          : "hover:border-primary/50"
                      )}
                    >
                      <span
                        className="mb-1 block h-6 w-full rounded"
                        style={{ backgroundColor: t.accent }}
                      />
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="accent">Accent color</Label>
                <input
                  id="accent"
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border bg-transparent"
                />
              </div>
              <TextAreaField label="Notes" value={notes} onValueChange={setNotes} />
              <TextAreaField label="Terms & conditions" value={terms} onValueChange={setTerms} />
            </CardContent>
          </Card>

          <TaxInvoiceChecklist
            problems={taxProblems}
            clientHref={selectedClient ? `/clients/${selectedClient.id}/edit` : undefined}
          />

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {ex ? "Save changes" : `Create ${typeLabel.toLowerCase()}`}
            </Button>
          </div>
        </div>

        {/* Live preview */}
        <div className={cn("lg:sticky lg:top-24 lg:self-start", mobileView === "edit" && "hidden lg:block")}>
          <div className="rounded-xl bg-muted/40 p-3 sm:p-4">
            <DocumentPreview view={view} />
          </div>
        </div>
      </div>
    </div>
  );
}

function prefixFor(type: DocType, p: BusinessProfile) {
  return type === "invoice" ? p.invoicePrefix : type === "quote" ? p.quotePrefix : p.receiptPrefix;
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8"
      />
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}
