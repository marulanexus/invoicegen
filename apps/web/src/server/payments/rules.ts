import type { Document } from "@/server/db/schema";
import { amountOwed, effectiveTotal, refundDue } from "@invoicegen/shared/calc";
import { formatCurrency } from "@/lib/money";

/**
 * Pure payment rules (no DB), used by ./service.ts and unit-tested directly.
 */

type PayableDoc = Pick<Document, "type" | "status" | "total" | "amountPaid" | "currency"> &
  Partial<Pick<Document, "adjustmentTotal">>;

/** What's still owed: total + credit/debit note adjustments − paid, never below zero. */
export function balanceOf(doc: Pick<Document, "total" | "amountPaid"> & Partial<Pick<Document, "adjustmentTotal">>): number {
  return amountOwed(doc);
}

export type PaymentProblem =
  | { code: "conflict"; message: string }
  | { code: "validation"; message: string };

/** Why a payment of `amount` can't be recorded against `doc`, or null if it can. */
export function paymentProblem(doc: PayableDoc, amount: number): PaymentProblem | null {
  if (doc.type !== "invoice") {
    return { code: "conflict", message: "Payments can only be recorded against invoices." };
  }
  if (doc.status === "void") {
    return { code: "conflict", message: "This invoice is void." };
  }
  const balance = balanceOf(doc);
  if (balance <= 0) {
    return { code: "conflict", message: "This invoice is already fully paid." };
  }
  // Half a cent of tolerance for rounding in clients that send floats.
  if (amount > balance + 0.005) {
    return {
      code: "validation",
      message: `Amount is more than the balance due (${formatCurrency(balance, doc.currency)}).`,
    };
  }
  return null;
}

/** Document status once `newAmountPaid` has been received in total. */
export function statusForAmountPaid(
  doc: Pick<Document, "total" | "status"> & Partial<Pick<Document, "adjustmentTotal">>,
  newAmountPaid: number
): { status: Document["status"]; fullyPaid: boolean } {
  const fullyPaid = newAmountPaid >= effectiveTotal(doc) - 0.005;
  if (fullyPaid) return { status: "paid", fullyPaid };
  if (newAmountPaid > 0) return { status: "partial", fullyPaid };
  return { status: doc.status, fullyPaid };
}

/** Why a refund of `amount` can't be recorded against `doc`, or null if it can. */
export function refundProblem(doc: PayableDoc, amount: number): PaymentProblem | null {
  if (doc.type !== "invoice") {
    return { code: "conflict", message: "Refunds can only be recorded against invoices." };
  }
  const due = refundDue(doc);
  if (due <= 0) {
    return { code: "conflict", message: "Nothing to refund: the client hasn't paid more than this invoice is worth." };
  }
  if (amount > due + 0.005) {
    return {
      code: "validation",
      message: `Amount is more than the refund due (${formatCurrency(due, doc.currency)}).`,
    };
  }
  return null;
}

/**
 * Invoice status once a payment or refund is deleted and `newAmountPaid` is
 * what's left. A cancelled invoice stays cancelled.
 */
export function statusAfterPaymentRemoved(
  doc: Pick<Document, "status" | "total"> & Partial<Pick<Document, "adjustmentTotal">>,
  newAmountPaid: number
): Document["status"] {
  if (doc.status === "void") return "void";
  if (newAmountPaid <= 0) return "sent";
  return newAmountPaid >= effectiveTotal(doc) - 0.005 ? "paid" : "partial";
}
