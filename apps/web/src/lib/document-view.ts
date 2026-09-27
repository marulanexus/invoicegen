/**
 * Normalized, render-ready representation of a document. The live builder, the
 * read-only detail page and the PDF renderer all consume this exact shape, so
 * what you preview is always what you send.
 */

import { documentHeading } from "@invoicegen/shared/tax-invoice";

import { calcDocumentTotals, calcLine } from "./calc";
import { round2, toNumber } from "./money";
import type { Document, LineItem } from "@/server/db/schema";

export interface PartyView {
  name: string;
  lines: string[];
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  /** Supplier only: registered VAT vendor (tax invoices, "VAT No."). */
  vatRegistered?: boolean;
}

export interface LineView {
  description: string;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  taxRate: number;
  amount: number;
}

export interface DocumentView {
  type: "invoice" | "quote" | "receipt";
  /** "TAX INVOICE" for VAT vendors' invoices, else "INVOICE"/"QUOTE"/"RECEIPT". */
  heading: string;
  number: string;
  status?: string;
  currency: string;
  issueDate?: string | null;
  dueDate?: string | null;
  validUntil?: string | null;
  poNumber?: string | null;
  from: PartyView;
  billTo?: PartyView | null;
  logoUrl?: string | null;
  items: LineView[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  taxLabel: string;
  taxInclusive: boolean;
  notes?: string | null;
  terms?: string | null;
  accentColor: string;
  templateKey: string;
  showPoweredBy: boolean;
}

export { documentHeading };

/** Distinct non-zero VAT rates used, for the "includes VAT at 15%" statement. */
export function taxRatesOf(items: Pick<LineView, "taxRate">[]): number[] {
  return [...new Set(items.map((i) => i.taxRate).filter((r) => r > 0))].sort((a, b) => a - b);
}

/** Recompute totals + per-line amounts from raw line input. */
export function viewLinesAndTotals(
  rawLines: {
    description?: string;
    quantity: number | string;
    unitPrice: number | string;
    discountRate?: number | string;
    taxRate?: number | string;
  }[],
  taxInclusive = false
) {
  const totals = calcDocumentTotals(rawLines, taxInclusive);
  const items: LineView[] = rawLines.map((l) => {
    return {
      description: l.description ?? "",
      quantity: toNumber(l.quantity),
      unitPrice: toNumber(l.unitPrice),
      discountRate: toNumber(l.discountRate),
      taxRate: toNumber(l.taxRate),
      amount: calcLine(l).net,
    };
  });
  return { items, totals };
}

function partyFromSnapshot(
  snap: Record<string, unknown> | null | undefined
): PartyView | null {
  if (!snap) return null;
  const lines: string[] = [];
  const addr = snap.address;
  if (Array.isArray(addr)) lines.push(...addr.filter((x): x is string => typeof x === "string"));
  if (typeof snap.company === "string" && snap.company) lines.unshift(snap.company);
  return {
    name: typeof snap.name === "string" ? snap.name : "—",
    lines,
    email: typeof snap.email === "string" ? snap.email : null,
    phone: typeof snap.phone === "string" ? snap.phone : null,
    taxId: typeof snap.taxId === "string" ? snap.taxId : null,
    vatRegistered: snap.vatRegistered === true,
  };
}

/** Build a render view from persisted document + line-item rows. */
export function viewFromStored(
  doc: Document,
  items: LineItem[],
  opts: { showPoweredBy: boolean }
): DocumentView {
  const from =
    partyFromSnapshot(doc.fromSnapshot) ?? { name: "Your business", lines: [] };
  const billTo = partyFromSnapshot(doc.billToSnapshot);
  const amountPaid = toNumber(doc.amountPaid);
  const total = toNumber(doc.total);

  return {
    type: doc.type,
    heading: documentHeading(doc.type, from.vatRegistered === true),
    number: doc.number,
    status: doc.status,
    currency: doc.currency,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    validUntil: doc.validUntil,
    poNumber: doc.poNumber,
    from,
    billTo,
    logoUrl:
      typeof doc.fromSnapshot?.logoUrl === "string"
        ? (doc.fromSnapshot.logoUrl as string)
        : null,
    items: items.map((i) => ({
      description: i.description,
      quantity: toNumber(i.quantity),
      unitPrice: toNumber(i.unitPrice),
      discountRate: toNumber(i.discountRate),
      taxRate: toNumber(i.taxRate),
      amount: toNumber(i.amount),
    })),
    subtotal: toNumber(doc.subtotal),
    discountTotal: toNumber(doc.discountTotal),
    taxTotal: toNumber(doc.taxTotal),
    total,
    amountPaid,
    balanceDue: round2(total - amountPaid),
    taxLabel: doc.taxLabel ?? "Tax",
    taxInclusive: doc.taxInclusive,
    notes: doc.notes,
    terms: doc.terms,
    accentColor: doc.accentColor ?? "#2563eb",
    templateKey: doc.templateKey,
    showPoweredBy: opts.showPoweredBy,
  };
}
