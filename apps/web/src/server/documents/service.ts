import "server-only";

import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/server/db";
import {
  clients,
  documents,
  lineItems,
  type BusinessProfile,
  type Client,
  type Document,
} from "@/server/db/schema";
import type { OrgContext } from "@/server/auth/context";
import { assertCanCreateDocument, PlanLimitError } from "@/server/billing/usage";
import { reserveDocumentNumber } from "@/server/documents/numbering";
import { logActivity } from "@/server/activity";
import { fail, invalid, ok, type ServiceResult } from "@/server/service-result";
import { calcDocumentTotals, calcLine } from "@/lib/calc";
import { toMoneyString } from "@/lib/money";
import { env } from "@/lib/env";
import { documentSchema, type DocumentInput, type LineItemInput } from "@/lib/validators";
import { addDays, statusActionBlocked, type StatusAction } from "@/server/documents/rules";
import { settleBalanceInTx } from "@/server/payments/service";

export { STATUS_ACTIONS, withProfileDefaults, type StatusAction } from "@/server/documents/rules";

/**
 * Document business rules, shared by the web server actions and `/api/v1`.
 * Callers resolve `ctx` (the tenant) first; every query here is scoped to it.
 */

function snapshotFrom(p: BusinessProfile | null) {
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

type ClientLookup = { ok: true; client: Client | undefined } | { ok: false; result: ServiceResult<never> };

/** A document may only reference a client of the same organization. */
async function resolveClient(orgId: string, clientId: string | null | undefined): Promise<ClientLookup> {
  if (!clientId) return { ok: true, client: undefined };
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.orgId, orgId)))
    .limit(1);
  if (!client) {
    return { ok: false, result: fail("validation", "Client not found.", { clientId: ["Client not found"] }) };
  }
  return { ok: true, client };
}

function totalsColumns(d: DocumentInput) {
  const t = calcDocumentTotals(d.lineItems, d.taxInclusive);
  return {
    subtotal: toMoneyString(t.subtotal),
    discountTotal: toMoneyString(t.discountTotal),
    taxTotal: toMoneyString(t.taxTotal),
    total: toMoneyString(t.total),
  };
}

function lineItemRows(documentId: string, items: LineItemInput[]) {
  return items.map((li, idx) => ({
    documentId,
    position: idx,
    description: li.description,
    quantity: String(li.quantity),
    unitPrice: toMoneyString(li.unitPrice),
    discountRate: String(li.discountRate ?? 0),
    taxRate: String(li.taxRate ?? 0),
    amount: toMoneyString(calcLine(li).net),
  }));
}

function editableColumns(d: DocumentInput) {
  return {
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
    ...totalsColumns(d),
  };
}

export async function createDocumentForOrg(
  ctx: OrgContext,
  raw: unknown
): Promise<ServiceResult<Document>> {
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  try {
    await assertCanCreateDocument(ctx);
  } catch (e) {
    if (e instanceof PlanLimitError) return fail("plan_limit", e.message);
    throw e;
  }

  const lookup = await resolveClient(ctx.org.id, d.clientId);
  if (!lookup.ok) return lookup.result;

  const doc = await db.transaction(async (tx) => {
    const number = await reserveDocumentNumber(tx, ctx.org.id, d.type);
    const [row] = await tx
      .insert(documents)
      .values({
        orgId: ctx.org.id,
        type: d.type,
        number,
        status: "draft",
        ...editableColumns(d),
        fromSnapshot: snapshotFrom(ctx.profile),
        billToSnapshot: snapshotBillTo(lookup.client),
        createdByMemberId: ctx.member.id,
      })
      .returning();
    await tx.insert(lineItems).values(lineItemRows(row.id, d.lineItems));
    return row;
  });

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: `${d.type}.created`,
    entityType: "document",
    entityId: doc.id,
    description: `Created ${d.type}`,
  });

  return ok(doc);
}

export async function updateDocumentForOrg(
  ctx: OrgContext,
  id: string,
  raw: unknown
): Promise<ServiceResult<Document>> {
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const lookup = await resolveClient(ctx.org.id, d.clientId);
  if (!lookup.ok) return lookup.result;

  const doc = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id)))
      .limit(1);
    if (!existing) return null;

    const [row] = await tx
      .update(documents)
      .set({
        ...editableColumns(d),
        billToSnapshot: snapshotBillTo(lookup.client) ?? existing.billToSnapshot,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();

    // Replace line items wholesale (simplest correct strategy).
    await tx.delete(lineItems).where(eq(lineItems.documentId, id));
    await tx.insert(lineItems).values(lineItemRows(id, d.lineItems));
    return row;
  });

  if (!doc) return fail("not_found", "Document not found.");
  return ok(doc);
}

export async function changeDocumentStatusForOrg(
  ctx: OrgContext,
  id: string,
  action: StatusAction
): Promise<ServiceResult<Document>> {
  // Lock the row so the check and the change see the same state (a payment
  // being recorded concurrently waits instead of racing "Mark as paid").
  const result = await db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id)))
      .limit(1)
      .for("update");
    if (!doc) return fail("not_found", "Document not found.");

    const blocked = statusActionBlocked(doc, action);
    if (blocked) return fail("conflict", blocked);

    // Record the outstanding balance as a payment so revenue and the
    // payments list agree with the invoice status.
    if (action === "mark_paid") return ok(await settleBalanceInTx(tx, ctx, doc));

    const patch: Partial<typeof documents.$inferInsert> = { updatedAt: new Date() };
    switch (action) {
      case "send":
        patch.status = "sent";
        patch.sentAt = new Date();
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

    const [row] = await tx.update(documents).set(patch).where(eq(documents.id, id)).returning();
    return ok(row);
  });

  if (!result.ok) return result;

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: `${result.data.type}.${action}`,
    entityType: "document",
    entityId: id,
    description: `${result.data.number} → ${result.data.status}`,
  });

  return result;
}

export async function deleteDocumentForOrg(
  ctx: OrgContext,
  id: string
): Promise<ServiceResult<Document>> {
  const [doc] = await db
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id)))
    .returning();
  if (!doc) return fail("not_found", "Document not found.");
  return ok(doc);
}

/**
 * Clone a quote into a new draft invoice (line items, notes, terms, template,
 * snapshots). Marks the source quote accepted. Returns the new invoice.
 */
export async function convertQuoteToInvoiceForOrg(
  ctx: OrgContext,
  quoteId: string
): Promise<ServiceResult<Document>> {
  try {
    await assertCanCreateDocument(ctx);
  } catch (e) {
    if (e instanceof PlanLimitError) return fail("plan_limit", e.message);
    throw e;
  }

  const [quote] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, quoteId), eq(documents.orgId, ctx.org.id)))
    .limit(1);
  if (!quote || quote.type !== "quote") return fail("not_found", "Quote not found.");

  const items = await db
    .select()
    .from(lineItems)
    .where(eq(lineItems.documentId, quoteId))
    .orderBy(lineItems.position);

  const issueDate = new Date().toISOString().slice(0, 10);
  const dueDate = addDays(issueDate, ctx.profile?.paymentTermsDays ?? 14);

  const invoice = await db.transaction(async (tx) => {
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

    return inv;
  });

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "quote.converted",
    entityType: "document",
    entityId: invoice.id,
    description: `Converted ${quote.number} to an invoice`,
  });

  return ok(invoice);
}

/**
 * The document's public share token (`/p/<token>`), created on first use.
 * Set only while still unset, so concurrent callers (share + send) agree on
 * one token and a link already handed out never stops working.
 */
export async function ensurePublicToken(orgId: string, id: string): Promise<string | null> {
  const scope = and(eq(documents.id, id), eq(documents.orgId, orgId));
  const [doc] = await db.select({ publicToken: documents.publicToken }).from(documents).where(scope).limit(1);
  if (!doc) return null;
  if (doc.publicToken) return doc.publicToken;

  await db
    .update(documents)
    .set({ publicToken: randomBytes(16).toString("hex"), updatedAt: new Date() })
    .where(and(scope, isNull(documents.publicToken)));
  const [fresh] = await db.select({ publicToken: documents.publicToken }).from(documents).where(scope).limit(1);
  return fresh?.publicToken ?? null;
}

export function shareUrl(token: string): string {
  return `${env.APP_URL}/p/${token}`;
}

/**
 * Public link to the online view of a document, for sharing by WhatsApp or
 * SMS. Doesn't change the document's status.
 */
export async function getShareLinkForOrg(
  ctx: OrgContext,
  id: string
): Promise<ServiceResult<{ url: string }>> {
  const token = await ensurePublicToken(ctx.org.id, id);
  if (!token) return fail("not_found", "Document not found.");
  return ok({ url: shareUrl(token) });
}
