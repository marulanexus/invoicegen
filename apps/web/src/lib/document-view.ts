/**
 * Normalized, render-ready representation of a document. The live builder, the
 * read-only detail page and the PDF renderer all consume this exact shape, so
 * what you preview is always what you send.
 */

import { calcDocumentTotals } from "./calc";
import { round2, toNumber } from "./money";
import type { Document, LineItem } from "@/server/db/schema";

export interface PartyView {
  name: string;
  lines: string[];
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
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

const DOC_TITLE: Record<DocumentView["type"], string> = {
  invoice: "INVOICE",
  quote: "QUOTE",
  receipt: "RECEIPT",
};

export function documentTitle(type: DocumentView["type"]): string {
  return DOC_TITLE[type];
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
    const qty = toNumber(l.quantity);
    const price = toNumber(l.unitPrice);
    const discountRate = toNumber(l.discountRate);
    const net = round2(qty * price * (1 - discountRate / 100));
    return {
      description: l.description ?? "",
      quantity: qty,
      unitPrice: price,
      discountRate,
      taxRate: toNumber(l.taxRate),
      amount: net,
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
