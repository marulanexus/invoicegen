"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import {
  businessProfiles,
  clients,
  documents,
  lineItems,
} from "@/server/db/schema";
import { requireOrgContext } from "@/server/auth/context";
import { assertCanCreateDocument, PlanLimitError } from "@/server/billing/usage";
import { reserveDocumentNumber } from "@/server/documents/numbering";
import { logActivity } from "@/server/activity";
import { calcDocumentTotals } from "@/lib/calc";
import { toMoneyString } from "@/lib/money";
import { documentSchema } from "@/lib/validators";
import type { BusinessProfile, Client } from "@/server/db/schema";

export interface DocumentActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

function snapshotFrom(p: BusinessProfile | undefined) {
  if (!p) return undefined;
  return {
    name: p.displayName,
    legalName: p.legalName,
    email: p.email,
    phone: p.phone,
    website: p.website,
    address: [p.addressLine1, p.addressLine2, [p.city, p.state].filter(Boolean).join(", "), p.postalCode, p.country].filter(Boolean),
    taxId: p.taxId,
    logoUrl: p.logoUrl,
  };
}

function snapshotBillTo(c: Client | undefined) {
  if (!c) return undefined;
  return {
    name: c.name,
    company: c.companyName,
    contact: c.contactName,
    email: c.email,
    phone: c.phone,
    address: [c.addressLine1, c.addressLine2, [c.city, c.state].filter(Boolean).join(", "), c.postalCode, c.country].filter(Boolean),
    taxId: c.taxId,
  };
}

export async function createDocument(
  raw: unknown
): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await assertCanCreateDocument(ctx);
  } catch (e) {
    if (e instanceof PlanLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const d = parsed.data;
  const totals = calcDocumentTotals(d.lineItems, d.taxInclusive);

  // Load related rows for snapshots.
  const [profile] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.orgId, ctx.org.id))
    .limit(1);
  const client = d.clientId
    ? (
        await db
          .select()
          .from(clients)
          .where(and(eq(clients.id, d.clientId), eq(clients.orgId, ctx.org.id)))
          .limit(1)
      )[0]
    : undefined;

  const id = await db.transaction(async (tx) => {
    const number = await reserveDocumentNumber(tx, ctx.org.id, d.type);

    const [doc] = await tx
      .insert(documents)
      .values({
        orgId: ctx.org.id,
        clientId: d.clientId ?? null,
        type: d.type,
        number,
        status: "draft",
        currency: d.currency,
        issueDate: d.issueDate,
        dueDate: d.dueDate || null,
        validUntil: d.validUntil || null,
        poNumber: d.poNumber,
        templateKey: d.templateKey,
        accentColor: d.accentColor,
        taxLabel: d.taxLabel,
        taxInclusive: d.taxInclusive,
        notes: d.notes,
        terms: d.terms,
        subtotal: toMoneyString(totals.subtotal),
        discountTotal: toMoneyString(totals.discountTotal),
        taxTotal: toMoneyString(totals.taxTotal),
        total: toMoneyString(totals.total),
        fromSnapshot: snapshotFrom(profile),
        billToSnapshot: snapshotBillTo(client),
        createdByMemberId: ctx.member.id,
      })
      .returning();

    await tx.insert(lineItems).values(
      d.lineItems.map((li, idx) => {
        const net = (li.quantity * li.unitPrice) * (1 - (li.discountRate ?? 0) / 100);
        return {
          documentId: doc.id,
          position: idx,
          description: li.description,
          quantity: String(li.quantity),
          unitPrice: toMoneyString(li.unitPrice),
          discountRate: String(li.discountRate ?? 0),
          taxRate: String(li.taxRate ?? 0),
          amount: toMoneyString(net),
        };
      })
    );

    return doc.id;
  });

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: `${d.type}.created`,
    entityType: "document",
    entityId: id,
    description: `Created ${d.type}`,
  });

  revalidatePath("/documents");
  revalidatePath(`/${d.type}s`);
  return { ok: true, id };
}

export async function updateDocument(
  id: string,
  raw: unknown
): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  const totals = calcDocumentTotals(d.lineItems, d.taxInclusive);

  const client = d.clientId
    ? (
        await db
          .select()
          .from(clients)
          .where(and(eq(clients.id, d.clientId), eq(clients.orgId, ctx.org.id)))
          .limit(1)
      )[0]
    : undefined;

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id)))
      .limit(1);
    if (!existing) throw new Error("NOT_FOUND");

    await tx
      .update(documents)
      .set({
        clientId: d.clientId ?? null,
        currency: d.currency,
        issueDate: d.issueDate,
        dueDate: d.dueDate || null,
        validUntil: d.validUntil || null,
        poNumber: d.poNumber,
        templateKey: d.templateKey,
        accentColor: d.accentColor,
        taxLabel: d.taxLabel,
        taxInclusive: d.taxInclusive,
        notes: d.notes,
        terms: d.terms,
        subtotal: toMoneyString(totals.subtotal),
        discountTotal: toMoneyString(totals.discountTotal),
        taxTotal: toMoneyString(totals.taxTotal),
        total: toMoneyString(totals.total),
        billToSnapshot: snapshotBillTo(client) ?? existing.billToSnapshot,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id));

    // Replace line items wholesale (simplest correct strategy).
    await tx.delete(lineItems).where(eq(lineItems.documentId, id));
    await tx.insert(lineItems).values(
      d.lineItems.map((li, idx) => {
        const net = (li.quantity * li.unitPrice) * (1 - (li.discountRate ?? 0) / 100);
        return {
          documentId: id,
          position: idx,
          description: li.description,
          quantity: String(li.quantity),
          unitPrice: toMoneyString(li.unitPrice),
          discountRate: String(li.discountRate ?? 0),
          taxRate: String(li.taxRate ?? 0),
          amount: toMoneyString(net),
        };
      })
    );
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { ok: true, id };
}

type StatusAction = "send" | "mark_paid" | "void" | "accept" | "decline" | "reopen";

export async function changeDocumentStatus(
  id: string,
  action: StatusAction
): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id)))
    .limit(1);
  if (!doc) return { ok: false, error: "Document not found." };

  const patch: Partial<typeof documents.$inferInsert> = { updatedAt: new Date() };

  switch (action) {
    case "send":
      patch.status = "sent";
      patch.sentAt = new Date();
      break;
    case "mark_paid":
      patch.status = "paid";
      patch.amountPaid = doc.total;
      patch.paidAt = new Date();
      break;
    case "void":
      patch.status = "void";
      break;
    case "accept":
      patch.status = "accepted";
      break;
    case "decline":
      patch.status = "declined";
      break;
    case "reopen":
      patch.status = "draft";
      patch.paidAt = null;
      break;
  }

  await db.update(documents).set(patch).where(eq(documents.id, id));

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: `${doc.type}.${action}`,
    entityType: "document",
    entityId: id,
    description: `${doc.number} → ${patch.status}`,
  });

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { ok: true, id };
}

export async function deleteDocument(id: string): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();
  const [doc] = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id)))
    .returning();
  if (!doc) return { ok: false, error: "Document not found." };

  revalidatePath("/documents");
  revalidatePath(`/${doc.type}s`);
  return { ok: true };
}

/**
 * Clone a quote into a new draft invoice (line items, notes, terms, template,
 * snapshots). Marks the source quote accepted. Returns the new invoice id.
 */
export async function convertQuoteToInvoice(
  quoteId: string
): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();

  try {
    await assertCanCreateDocument(ctx);
  } catch (e) {
    if (e instanceof PlanLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const [quote] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, quoteId), eq(documents.orgId, ctx.org.id)))
    .limit(1);
  if (!quote || quote.type !== "quote") {
    return { ok: false, error: "Quote not found." };
  }

  const items = await db
    .select()
    .from(lineItems)
    .where(eq(lineItems.documentId, quoteId))
    .orderBy(lineItems.position);

  const [profile] = await db
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.orgId, ctx.org.id))
    .limit(1);

  const today = new Date();
  const issueDate = today.toISOString().slice(0, 10);
  const due = new Date(today);
  due.setDate(due.getDate() + (profile?.paymentTermsDays ?? 14));
  const dueDate = due.toISOString().slice(0, 10);

  const newId = await db.transaction(async (tx) => {
    const number = await reserveDocumentNumber(tx, ctx.org.id, "invoice");
    const [inv] = await tx
      .insert(documents)
      .values({
        orgId: ctx.org.id,
        clientId: quote.clientId,
        type: "invoice",
        number,
        status: "draft",
        currency: quote.currency,
        issueDate,
        dueDate,
        poNumber: quote.poNumber,
        templateKey: quote.templateKey,
        accentColor: quote.accentColor,
        taxLabel: quote.taxLabel,
        taxInclusive: quote.taxInclusive,
        notes: quote.notes,
        terms: quote.terms,
        subtotal: quote.subtotal,
        discountTotal: quote.discountTotal,
        taxTotal: quote.taxTotal,
        total: quote.total,
        fromSnapshot: quote.fromSnapshot,
        billToSnapshot: quote.billToSnapshot,
        createdByMemberId: ctx.member.id,
      })
      .returning();

    if (items.length) {
      await tx.insert(lineItems).values(
        items.map((i) => ({
          documentId: inv.id,
          position: i.position,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountRate: i.discountRate,
          taxRate: i.taxRate,
          amount: i.amount,
        }))
      );
    }

    // Mark the quote accepted if it wasn't already declined/void.
    if (quote.status !== "declined" && quote.status !== "void") {
      await tx
        .update(documents)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(documents.id, quoteId));
    }

    return inv.id;
  });

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "quote.converted",
    entityType: "document",
    entityId: newId,
    description: `Converted ${quote.number} to an invoice`,
  });

  revalidatePath("/invoices");
  revalidatePath("/quotes");
  revalidatePath(`/documents/${quoteId}`);
  return { ok: true, id: newId };
}
