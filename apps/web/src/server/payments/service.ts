import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { documents, payments, type Document, type Payment } from "@/server/db/schema";
import type { OrgContext } from "@/server/auth/context";
import { logActivity } from "@/server/activity";
import { fail, invalid, ok, type ServiceResult } from "@/server/service-result";
import { effectiveTotal } from "@invoicegen/shared/calc";
import { formatCurrency, round2, toMoneyString, toNumber } from "@/lib/money";
import { paymentSchema } from "@/lib/validators";
import {
  balanceOf,
  paymentProblem,
  refundProblem,
  statusAfterPaymentRemoved,
  statusForAmountPaid,
} from "@/server/payments/rules";

/**
 * Payment business rules, shared by the web server actions and `/api/v1`.
 * The invoice row is locked (`FOR UPDATE`) while its balance changes, so two
 * payments recorded at the same moment can't overwrite each other's total.
 */

export async function recordPaymentForOrg(
  ctx: OrgContext,
  raw: unknown
): Promise<ServiceResult<{ payment: Payment; document: Document }>> {
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, d.documentId), eq(documents.orgId, ctx.org.id)))
      .limit(1)
      .for("update");
    if (!doc) return fail("not_found", "Invoice not found.");

    const problem = paymentProblem(doc, d.amount);
    if (problem) {
      return problem.code === "validation"
        ? fail("validation", problem.message, { amount: [problem.message] })
        : fail("conflict", problem.message);
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        orgId: ctx.org.id,
        documentId: doc.id,
        clientId: doc.clientId,
        amount: toMoneyString(d.amount),
        currency: doc.currency,
        method: d.method,
        reference: d.reference,
        notes: d.notes,
        paidAt: new Date(d.paidAt),
        recordedByMemberId: ctx.member.id,
      })
      .returning();

    const newPaid = round2(toNumber(doc.amountPaid) + d.amount);
    const next = statusForAmountPaid(doc, newPaid);
    const [document] = await tx
      .update(documents)
      .set({
        amountPaid: toMoneyString(newPaid),
        status: next.status,
        paidAt: next.fullyPaid ? new Date() : doc.paidAt,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id))
      .returning();

    return ok({ payment, document });
  });

  if (!result.ok) return result;

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "payment.recorded",
    entityType: "document",
    entityId: result.data.document.id,
    description: `Recorded payment on ${result.data.document.number}`,
  });

  return result;
}

/**
 * Record money paid back to the client (e.g. after a credit note on a paid
 * invoice). Lowers what the invoice shows as paid; revenue nets it off.
 * Refunds up to what was overpaid, or everything paid on a void invoice.
 */
export async function recordRefundForOrg(
  ctx: OrgContext,
  raw: unknown
): Promise<ServiceResult<{ payment: Payment; document: Document }>> {
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, d.documentId), eq(documents.orgId, ctx.org.id)))
      .limit(1)
      .for("update");
    if (!doc) return fail("not_found", "Invoice not found.");

    const problem = refundProblem(doc, d.amount);
    if (problem) {
      return problem.code === "validation"
        ? fail("validation", problem.message, { amount: [problem.message] })
        : fail("conflict", problem.message);
    }

    const [payment] = await tx
      .insert(payments)
      .values({
        orgId: ctx.org.id,
        documentId: doc.id,
        clientId: doc.clientId,
        kind: "refund",
        amount: toMoneyString(d.amount),
        currency: doc.currency,
        method: d.method,
        reference: d.reference,
        notes: d.notes,
        paidAt: new Date(d.paidAt),
        recordedByMemberId: ctx.member.id,
      })
      .returning();

    // Only the overpayment is refundable, so a live invoice stays paid.
    const [document] = await tx
      .update(documents)
      .set({ amountPaid: toMoneyString(round2(toNumber(doc.amountPaid) - d.amount)), updatedAt: new Date() })
      .where(eq(documents.id, doc.id))
      .returning();

    return ok({ payment, document });
  });

  if (!result.ok) return result;

  const { payment, document } = result.data;
  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "refund.recorded",
    entityType: "document",
    entityId: document.id,
    description: `Refunded ${formatCurrency(payment.amount, payment.currency)} on ${document.number}`,
  });

  return result;
}

/**
 * Record whatever is still owed as one payment and mark the invoice paid
 * ("Mark as paid"). Keeps revenue and the payments list in step with the
 * invoice status. Runs inside the caller's transaction.
 */
export async function settleBalanceInTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ctx: OrgContext,
  doc: Document
): Promise<Document> {
  const balance = balanceOf(doc);
  if (balance > 0) {
    await tx.insert(payments).values({
      orgId: ctx.org.id,
      documentId: doc.id,
      clientId: doc.clientId,
      amount: toMoneyString(balance),
      currency: doc.currency,
      method: "other",
      reference: "Marked as paid",
      paidAt: new Date(),
      recordedByMemberId: ctx.member.id,
    });
  }
  const [row] = await tx
    .update(documents)
    .set({ status: "paid", amountPaid: toMoneyString(effectiveTotal(doc)), paidAt: new Date(), updatedAt: new Date() })
    .where(eq(documents.id, doc.id))
    .returning();
  return row;
}

export async function deletePaymentForOrg(
  ctx: OrgContext,
  id: string
): Promise<ServiceResult<{ documentId: string }>> {
  const result = await db.transaction(async (tx) => {
    const [pay] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.orgId, ctx.org.id)))
      .limit(1);
    if (!pay) return fail("not_found", "Payment not found.");

    const [doc] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, pay.documentId), eq(documents.orgId, ctx.org.id)))
      .limit(1)
      .for("update");

    // Deleting a refund puts the money back as paid; deleting a payment takes it off.
    const signed = pay.kind === "refund" ? -toNumber(pay.amount) : toNumber(pay.amount);
    const newPaid = doc ? round2(toNumber(doc.amountPaid) - signed) : 0;
    if (doc && newPaid < -0.005) {
      return fail("conflict", "This money has been refunded. Delete the refund first.");
    }

    await tx.delete(payments).where(eq(payments.id, id));

    if (doc) {
      const paid = Math.max(newPaid, 0);
      await tx
        .update(documents)
        .set({
          amountPaid: toMoneyString(paid),
          status: statusAfterPaymentRemoved(doc, paid),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, doc.id));
    }
    return ok({ documentId: pay.documentId });
  });

  return result;
}
