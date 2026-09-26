"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { documents, payments } from "@/server/db/schema";
import { requireOrgContext } from "@/server/auth/context";
import { logActivity } from "@/server/activity";
import { balanceDue } from "@/lib/calc";
import { round2, toMoneyString, toNumber } from "@/lib/money";
import { paymentSchema } from "@/lib/validators";

export interface PaymentActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function recordPayment(raw: unknown): Promise<PaymentActionResult> {
  const ctx = await requireOrgContext();
  const parsed = paymentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the payment details.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  const result = await db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, d.documentId), eq(documents.orgId, ctx.org.id)))
      .limit(1);
    if (!doc) return { ok: false as const, error: "Document not found." };

    await tx.insert(payments).values({
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
    });

    const newPaid = round2(toNumber(doc.amountPaid) + d.amount);
    const total = toNumber(doc.total);
    const fullyPaid = newPaid >= total - 0.001;

    await tx
      .update(documents)
      .set({
        amountPaid: toMoneyString(newPaid),
        status: fullyPaid ? "paid" : newPaid > 0 ? "partial" : doc.status,
        paidAt: fullyPaid ? new Date() : doc.paidAt,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, doc.id));

    return { ok: true as const, docId: doc.id, number: doc.number };
  });

  if (!result.ok) return result;

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "payment.recorded",
    entityType: "document",
    entityId: result.docId,
    description: `Recorded payment on ${result.number}`,
  });

  revalidatePath("/payments");
  revalidatePath(`/documents/${result.docId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deletePayment(id: string): Promise<PaymentActionResult> {
  const ctx = await requireOrgContext();

  await db.transaction(async (tx) => {
    const [pay] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.orgId, ctx.org.id)))
      .limit(1);
    if (!pay) return;

    await tx.delete(payments).where(eq(payments.id, id));

    const [doc] = await tx
      .select()
      .from(documents)
      .where(eq(documents.id, pay.documentId))
      .limit(1);
    if (doc) {
      const newPaid = round2(toNumber(doc.amountPaid) - toNumber(pay.amount));
      const remaining = balanceDue(doc.total, toMoneyString(Math.max(newPaid, 0)));
      await tx
        .update(documents)
        .set({
          amountPaid: toMoneyString(Math.max(newPaid, 0)),
          status: newPaid <= 0 ? "sent" : remaining <= 0 ? "paid" : "partial",
          updatedAt: new Date(),
        })
        .where(eq(documents.id, doc.id));
    }
  });

  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { ok: true };
}
