import { isSouthAfrica } from "@invoicegen/shared/tax-invoice";

import type { BusinessProfile, Document } from "@/server/db/schema";
import { round2 } from "@/lib/money";

/**
 * Pure document rules (no DB), used by ./service.ts and unit-tested directly.
 */

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fill fields the caller left out from the business profile, the way the web
 * builder pre-fills its form (currency, tax, template, notes, due date…).
 * Used by the API so a phone can create a correct ZAR/VAT invoice from just a
 * client and line items. Fields that are present are never overridden.
 */
export function withProfileDefaults(
  raw: unknown,
  profile: BusinessProfile | null,
  today: Date = new Date()
): unknown {
  if (!profile || typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const r = raw as Record<string, unknown>;
  const or = <T>(key: string, fallback: T) => (r[key] === undefined ? fallback : r[key]);

  const issueDate = or("issueDate", today.toISOString().slice(0, 10));
  const dueDate =
    r.dueDate === undefined && r.type === "invoice" && typeof issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(issueDate)
      ? addDays(issueDate, profile.paymentTermsDays)
      : r.dueDate;

  const lineItems = Array.isArray(r.lineItems)
    ? r.lineItems.map((li) =>
        typeof li === "object" && li !== null && (li as Record<string, unknown>).taxRate === undefined
          ? { ...li, taxRate: Number(profile.defaultTaxRate ?? 0) }
          : li
      )
    : r.lineItems;

  return {
    ...r,
    currency: or("currency", profile.defaultCurrency),
    issueDate,
    dueDate,
    templateKey: or("templateKey", profile.defaultTemplateKey),
    accentColor: or("accentColor", profile.brandColor ?? undefined),
    taxLabel: or("taxLabel", profile.taxLabel ?? undefined),
    taxInclusive: or("taxInclusive", profile.taxInclusive),
    notes: or("notes", profile.defaultNotes ?? undefined),
    terms: or("terms", profile.defaultTerms ?? undefined),
    lineItems,
  };
}

export const STATUS_ACTIONS = ["send", "mark_paid", "void", "accept", "decline", "reopen"] as const;
export type StatusAction = (typeof STATUS_ACTIONS)[number];

/** Why `action` can't apply to `doc` right now, or null when it can. */
export function statusActionBlocked(doc: Document, action: StatusAction): string | null {
  switch (action) {
    case "send":
      return doc.status === "draft" ? null : "Only drafts can be marked as sent.";
    case "mark_paid":
      if (doc.type === "quote") return "Quotes can't be marked as paid.";
      return doc.status === "paid" || doc.status === "void"
        ? `A ${doc.status} document can't be marked as paid.`
        : null;
    case "accept":
    case "decline":
      return doc.type === "quote" ? null : "Only quotes can be accepted or declined.";
    case "reopen":
      return doc.status === "draft" ? "This document is already a draft." : null;
    case "void":
      return doc.status === "void" ? "This document is already void." : null;
  }
}

/* ───────────────────────── Credit and debit notes ───────────────────────── */

/**
 * An issued South African tax invoice can't be edited, reopened, voided or
 * deleted: s20(1) allows one tax invoice per supply, and changes to it go
 * through credit/debit notes (s21).
 */
export function isLockedTaxInvoice(doc: Pick<Document, "type" | "status" | "fromSnapshot">): boolean {
  return (
    doc.type === "invoice" &&
    doc.status !== "draft" &&
    doc.fromSnapshot?.vatRegistered === true &&
    isSouthAfrica(typeof doc.fromSnapshot?.country === "string" ? doc.fromSnapshot.country : null)
  );
}

export function isNote(doc: Pick<Document, "type">): boolean {
  return doc.type === "credit_note" || doc.type === "debit_note";
}

export type NoteKind = "credit" | "debit";

export interface NoteRequest {
  kind: NoteKind;
  reason: string;
  /** "full": credit everything still invoiced (credit notes only). */
  mode: "full" | "amount";
  /** Amount including VAT, for mode "amount". */
  amount?: number;
  description?: string;
  /** VAT rate for mode "amount"; defaults to the invoice's rate when it has one. */
  taxRate?: number;
}

export interface NoteLine {
  description: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
}

type InvoiceForNote = Pick<Document, "type" | "status" | "number" | "total" | "adjustmentTotal" | "taxInclusive">;
type ItemForNote = { description: string; quantity: string; unitPrice: string; discountRate: string; taxRate: string };

/**
 * The lines of a credit/debit note, or why it can't be issued. Amounts are
 * VAT-inclusive (what the owner thinks in), so an "amount" note is built as a
 * tax-inclusive line and its total is exactly the amount entered.
 */
export function buildNote(
  invoice: InvoiceForNote,
  items: ItemForNote[],
  req: NoteRequest
): { ok: true; lines: NoteLine[]; taxInclusive: boolean } | { ok: false; error: string } {
  if (invoice.type !== "invoice") return { ok: false, error: "Credit and debit notes can only be issued against invoices." };
  if (invoice.status === "draft") return { ok: false, error: "This invoice hasn't been issued yet. Edit the draft instead." };
  if (invoice.status === "void") return { ok: false, error: "This invoice is already cancelled." };

  const remaining = round2(Number(invoice.total) + Number(invoice.adjustmentTotal ?? 0));
  const rates = [...new Set(items.map((i) => Number(i.taxRate)))];

  if (req.mode === "full") {
    if (req.kind !== "credit") return { ok: false, error: "Only a credit note can cancel the full invoice." };
    if (remaining <= 0) return { ok: false, error: "Nothing left to credit on this invoice." };
    // Untouched invoice: mirror its lines exactly. Otherwise credit what's left.
    if (Number(invoice.adjustmentTotal ?? 0) === 0) {
      return {
        ok: true,
        taxInclusive: invoice.taxInclusive,
        lines: items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discountRate: Number(i.discountRate),
          taxRate: Number(i.taxRate),
        })),
      };
    }
    if (rates.length !== 1) return { ok: false, error: "Enter the amount to credit and its VAT rate." };
    return {
      ok: true,
      taxInclusive: true,
      lines: [{ description: `Cancellation of ${invoice.number}`, quantity: 1, unitPrice: remaining, discountRate: 0, taxRate: rates[0] }],
    };
  }

  const amount = round2(req.amount ?? 0);
  if (!(amount > 0)) return { ok: false, error: "Enter an amount greater than 0." };
  if (req.kind === "credit" && amount > remaining + 0.005) {
    return { ok: false, error: `You can credit at most ${remaining.toFixed(2)} on this invoice.` };
  }
  const taxRate = req.taxRate ?? (rates.length === 1 ? rates[0] : undefined);
  if (taxRate === undefined) return { ok: false, error: "This invoice has several VAT rates. Choose the rate for this note." };

  return {
    ok: true,
    taxInclusive: true,
    lines: [
      {
        description: req.description?.trim() || `${req.kind === "credit" ? "Reduction" : "Additional charge"} on ${invoice.number}`,
        quantity: 1,
        unitPrice: amount,
        discountRate: 0,
        taxRate,
      },
    ],
  };
}

/**
 * Invoice status after a note changes what it's worth: fully credited means
 * cancelled (void); otherwise paid/partial follow what's been received.
 */
export function statusAfterAdjustment(
  invoice: Pick<Document, "status" | "total" | "amountPaid">,
  newAdjustment: number
): Document["status"] {
  const effective = round2(Number(invoice.total) + newAdjustment);
  const paid = Number(invoice.amountPaid);
  if (effective <= 0.005) return "void";
  if (paid >= effective - 0.005) return "paid";
  if (paid > 0) return "partial";
  // Unpaid: an invoice that was "paid" before a debit note is now just issued.
  return invoice.status === "paid" || invoice.status === "partial" ? "sent" : invoice.status;
}

export type LockedAction = "edit" | "reopen" | "void" | "delete" | "status";

/** Why `action` isn't allowed on an issued tax invoice or a note, or null if it is. */
export function lockReason(
  doc: Pick<Document, "type" | "status" | "fromSnapshot">,
  action: LockedAction
): string | null {
  if (isNote(doc)) {
    return "Credit and debit notes can't be changed once issued. Issue another note to correct it.";
  }
  if (!isLockedTaxInvoice(doc)) return null;
  switch (action) {
    case "edit":
      return "This tax invoice has been issued, so it can't be edited. Issue a credit note or debit note instead.";
    case "reopen":
      return "This tax invoice has been issued, so it can't be reopened. Issue a credit note or debit note instead.";
    case "void":
      return "To cancel an issued tax invoice, issue a credit note for the full amount.";
    case "delete":
      return "Issued tax invoices can't be deleted. Cancel it with a credit note instead.";
    case "status":
      return null;
  }
}
