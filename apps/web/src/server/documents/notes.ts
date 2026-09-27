import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import { documents, lineItems, type Document } from "@/server/db/schema";
import type { OrgContext } from "@/server/auth/context";
import { reserveDocumentNumber } from "@/server/documents/numbering";
import { buildNote, statusAfterAdjustment } from "@/server/documents/rules";
import { logActivity } from "@/server/activity";
import { fail, invalid, ok, type ServiceResult } from "@/server/service-result";
import { calcDocumentTotals, calcLine } from "@/lib/calc";
import { formatCurrency, round2, toMoneyString, toNumber } from "@/lib/money";

/**
 * Credit and debit notes (VAT Act s21). A note is its own numbered document
 * (CN-/DN-) that references the invoice and says why it was issued. It never
 * changes the invoice's issued total; instead the invoice's adjustmentTotal
 * moves, so what's owed = total + adjustmentTotal − amountPaid everywhere.
 */

export const noteSchema = z.object({
  kind: z.enum(["credit", "debit"]),
  reason: z.string().trim().min(3, "Say why this note is issued").max(500),
  mode: z.enum(["full", "amount"]).default("amount"),
  amount: z.coerce.number().positive("Amount must be greater than 0").optional(),
  description: z.string().trim().max(500).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  /** YYYY-MM-DD in the owner's time zone; defaults to today (UTC). */
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function issueNoteForOrg(
  ctx: OrgContext,
  invoiceId: string,
  raw: unknown
): Promise<ServiceResult<{ note: Document; invoice: Document }>> {
  const parsed = noteSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const req = parsed.data;
  const type = req.kind === "credit" ? "credit_note" : "debit_note";

  const result = await db.transaction(async (tx) => {
    // Lock the invoice so concurrent notes/payments see each other's changes.
    const [invoice] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, invoiceId), eq(documents.orgId, ctx.org.id)))
      .limit(1)
      .for("update");
    if (!invoice) return fail("not_found", "Invoice not found.");

    const items = await tx
      .select()
      .from(lineItems)
      .where(eq(lineItems.documentId, invoice.id))
      .orderBy(asc(lineItems.position));

    const built = buildNote(invoice, items, req);
    if (!built.ok) return fail("conflict", built.error);

    const totals = calcDocumentTotals(built.lines, built.taxInclusive);
    const number = await reserveDocumentNumber(tx, ctx.org.id, type);
    const issueDate = req.issueDate ?? new Date().toISOString().slice(0, 10);

    const [note] = await tx
      .insert(documents)
      .values({
        orgId: ctx.org.id,
        clientId: invoice.clientId,
        type,
        number,
        // A note is issued the moment it's created (it corrects an issued invoice).
        status: "sent",
        sentAt: new Date(),
        currency: invoice.currency,
        issueDate,
        templateKey: invoice.templateKey,
        accentColor: invoice.accentColor,
        taxLabel: invoice.taxLabel,
        taxInclusive: built.taxInclusive,
        subtotal: toMoneyString(totals.subtotal),
        discountTotal: toMoneyString(totals.discountTotal),
        taxTotal: toMoneyString(totals.taxTotal),
        total: toMoneyString(totals.total),
        // Same parties as the invoice, as issued (s21(3)(ii)–(iii)).
        fromSnapshot: invoice.fromSnapshot,
        billToSnapshot: invoice.billToSnapshot,
        relatedDocumentId: invoice.id,
        reason: req.reason,
        createdByMemberId: ctx.member.id,
      })
      .returning();

    await tx.insert(lineItems).values(
      built.lines.map((l, idx) => ({
        documentId: note.id,
        position: idx,
        description: l.description,
        quantity: String(l.quantity),
        unitPrice: toMoneyString(l.unitPrice),
        discountRate: String(l.discountRate),
        taxRate: String(l.taxRate),
        amount: toMoneyString(calcLine(l).net),
      }))
    );

    const delta = req.kind === "credit" ? -totals.total : totals.total;
    const newAdjustment = round2(toNumber(invoice.adjustmentTotal) + delta);
    const [updated] = await tx
      .update(documents)
      .set({
        adjustmentTotal: toMoneyString(newAdjustment),
        status: statusAfterAdjustment(invoice, newAdjustment),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, invoice.id))
      .returning();

    const refundDue = round2(toNumber(invoice.amountPaid) - (toNumber(invoice.total) + newAdjustment));
    return ok({ note, invoice: updated, refundDue });
  });

  if (!result.ok) return result;
  const { note, invoice, refundDue } = result.data;

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: `${note.type}.issued`,
    entityType: "document",
    entityId: note.id,
    description:
      `${note.number} (${formatCurrency(note.total, note.currency)}) against ${invoice.number}: ${note.reason}` +
      (refundDue > 0.005 ? ` — client has overpaid ${formatCurrency(refundDue, note.currency)}; refund due` : ""),
  });

  return ok({ note, invoice });
}

/** Credit/debit notes issued against these invoices, oldest first. */
export async function listNotesFor(orgId: string, invoiceIds: string[]): Promise<Document[]> {
  if (invoiceIds.length === 0) return [];
  return db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, orgId), inArray(documents.relatedDocumentId, invoiceIds)))
    .orderBy(asc(documents.createdAt));
}
