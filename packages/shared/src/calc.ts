import { round2, toNumber } from "./money";

/**
 * Pure document math, shared by the invoice builder (live preview) and the
 * server (authoritative totals at save time). Keeping this in one place means
 * the number a user sees while editing always matches what gets stored.
 */

export interface CalcLineInput {
  quantity: number | string;
  unitPrice: number | string;
  discountRate?: number | string; // percent, per line
  taxRate?: number | string; // percent, per line
}

export interface CalcLineResult {
  /** Gross before discount/tax. */
  gross: number;
  discount: number;
  /** Net = gross - discount (this is the line "amount" we store). */
  net: number;
  tax: number;
}

export function calcLine(line: CalcLineInput): CalcLineResult {
  const qty = toNumber(line.quantity);
  const price = toNumber(line.unitPrice);
  const discountRate = toNumber(line.discountRate);
  const taxRate = toNumber(line.taxRate);

  const gross = round2(qty * price);
  const discount = round2(gross * (discountRate / 100));
  const net = round2(gross - discount);
  const tax = round2(net * (taxRate / 100));

  return { gross, discount, net, tax };
}

export interface DocumentTotals {
  subtotal: number; // sum of net line amounts
  discountTotal: number;
  taxTotal: number;
  total: number;
}

/**
 * @param taxInclusive When true, line prices already include tax; the tax
 *   figure is derived out of the total rather than added on top.
 */
export function calcDocumentTotals(
  lines: CalcLineInput[],
  taxInclusive = false
): DocumentTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const line of lines) {
    const { net, discount, tax } = calcLine(line);
    subtotal = round2(subtotal + net);
    discountTotal = round2(discountTotal + discount);
    taxTotal = round2(taxTotal + tax);
  }

  if (taxInclusive) {
    // Prices already include tax: total == subtotal, tax is the embedded part.
    return {
      subtotal: round2(subtotal - taxTotal),
      discountTotal,
      taxTotal,
      total: subtotal,
    };
  }

  return {
    subtotal,
    discountTotal,
    taxTotal,
    total: round2(subtotal + taxTotal),
  };
}

/** Balance still owed on a document. */
export function balanceDue(total: number | string, amountPaid: number | string) {
  return round2(toNumber(total) - toNumber(amountPaid));
}

type Owable = {
  total: number | string;
  amountPaid: number | string;
  /** Debit notes minus credit notes issued against the invoice. */
  adjustmentTotal?: number | string | null;
};

/** The invoice amount after credit and debit notes (the issued total never changes). */
export function effectiveTotal(doc: Pick<Owable, "total" | "adjustmentTotal">): number {
  return round2(toNumber(doc.total) + toNumber(doc.adjustmentTotal));
}

/** What the client still owes: total + adjustments − paid, never below zero. */
export function amountOwed(doc: Owable): number {
  return Math.max(round2(effectiveTotal(doc) - toNumber(doc.amountPaid)), 0);
}

/**
 * What the business owes the client back: anything paid above what the invoice
 * is now worth (e.g. credited after payment). A cancelled (void) invoice is
 * worth nothing, so everything paid on it is refundable.
 */
export function refundDue(doc: Owable & { status?: string }): number {
  const worth = doc.status === "void" ? 0 : effectiveTotal(doc);
  return Math.max(round2(toNumber(doc.amountPaid) - worth), 0);
}
