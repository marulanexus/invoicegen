import type { Document } from "@/server/db/schema";
import { formatCurrency, round2, toNumber } from "@/lib/money";

/**
 * Pure payment rules (no DB), used by ./service.ts and unit-tested directly.
 */

type PayableDoc = Pick<Document, "type" | "status" | "total" | "amountPaid" | "currency">;

/** What's still owed on a document, never below zero. */
export function balanceOf(doc: Pick<Document, "total" | "amountPaid">): number {
  return Math.max(round2(toNumber(doc.total) - toNumber(doc.amountPaid)), 0);
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
  doc: Pick<Document, "total" | "status">,
  newAmountPaid: number
): { status: Document["status"]; fullyPaid: boolean } {
  const fullyPaid = newAmountPaid >= toNumber(doc.total) - 0.005;
  if (fullyPaid) return { status: "paid", fullyPaid };
  if (newAmountPaid > 0) return { status: "partial", fullyPaid };
  return { status: doc.status, fullyPaid };
}
