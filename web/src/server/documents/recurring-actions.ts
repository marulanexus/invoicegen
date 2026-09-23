"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { documents, lineItems, recurringInvoices } from "@/server/db/schema";
import { requireOrgContext } from "@/server/auth/context";
import { logActivity } from "@/server/activity";

export interface RecurringResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export interface RecurringPayload {
  clientId: string;
  currency: string;
  taxLabel: string | null;
  taxInclusive: boolean;
  templateKey: string;
  accentColor: string | null;
  poNumber: string | null;
  notes: string | null;
  terms: string | null;
  paymentTermsDays: number;
  lineItems: {
    description: string;
    quantity: string;
    unitPrice: string;
    discountRate: string;
    taxRate: string;
  }[];
}

/** Create a recurring schedule from an existing invoice. */
export async function createRecurringFromInvoice(input: {
  invoiceId: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  interval: number;
  startDate: string;
  endDate?: string | null;
  paymentTermsDays?: number;
}): Promise<RecurringResult> {
  const ctx = await requireOrgContext();

  if (!ctx.plan.features.recurringInvoices) {
    return {
      ok: false,
      error: "Recurring invoices are available on the Growth Pro plan and above.",
    };
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.id, input.invoiceId), eq(documents.orgId, ctx.org.id))
    )
    .limit(1);
  if (!doc) return { ok: false, error: "Invoice not found." };
  if (!doc.clientId) {
    return { ok: false, error: "Add a client to the invoice before scheduling." };
  }

  const items = await db
    .select()
    .from(lineItems)
    .where(eq(lineItems.documentId, doc.id))
    .orderBy(lineItems.position);

  const payload: RecurringPayload = {
    clientId: doc.clientId,
    currency: doc.currency,
    taxLabel: doc.taxLabel,
    taxInclusive: doc.taxInclusive,
    templateKey: doc.templateKey,
    accentColor: doc.accentColor,
    poNumber: doc.poNumber,
    notes: doc.notes,
    terms: doc.terms,
    paymentTermsDays: input.paymentTermsDays ?? ctx.profile?.paymentTermsDays ?? 14,
    lineItems: items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discountRate: i.discountRate,
      taxRate: i.taxRate,
    })),
  };

  const [row] = await db
    .insert(recurringInvoices)
    .values({
      orgId: ctx.org.id,
      clientId: doc.clientId,
      frequency: input.frequency,
      interval: Math.max(1, input.interval),
      nextRunDate: input.startDate,
      endDate: input.endDate || null,
      active: true,
      payload: payload as unknown as Record<string, unknown>,
    })
    .returning();

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "recurring.created",
    entityType: "recurring",
    entityId: row.id,
    description: `Scheduled a recurring invoice (${input.frequency})`,
  });

  revalidatePath("/invoices/recurring");
  return { ok: true, id: row.id };
}

export async function setRecurringActive(
  id: string,
  active: boolean
): Promise<RecurringResult> {
  const ctx = await requireOrgContext();
  const [row] = await db
    .update(recurringInvoices)
    .set({ active })
    .where(
      and(eq(recurringInvoices.id, id), eq(recurringInvoices.orgId, ctx.org.id))
    )
    .returning();
  if (!row) return { ok: false, error: "Schedule not found." };
  revalidatePath("/invoices/recurring");
  return { ok: true, id };
}

export async function deleteRecurring(id: string): Promise<RecurringResult> {
  const ctx = await requireOrgContext();
  const [row] = await db
    .delete(recurringInvoices)
    .where(
      and(eq(recurringInvoices.id, id), eq(recurringInvoices.orgId, ctx.org.id))
    )
    .returning();
  if (!row) return { ok: false, error: "Schedule not found." };
  revalidatePath("/invoices/recurring");
  return { ok: true };
}
