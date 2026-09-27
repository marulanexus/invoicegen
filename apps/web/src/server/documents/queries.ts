import "server-only";

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import {
  clients,
  documents,
  lineItems,
  payments,
  type Client,
  type Document,
  type LineItem,
  type Payment,
} from "@/server/db/schema";

/** Types that have their own list screen (notes are listed on their invoice). */
export type DocumentType = "invoice" | "quote" | "receipt";

export type DocumentListItem = Document & {
  clientName: string | null;
};

export async function listDocuments(
  orgId: string,
  opts: {
    type?: DocumentType;
    status?: string;
    clientId?: string;
    search?: string;
    limit?: number;
  } = {}
): Promise<DocumentListItem[]> {
  const conditions = [eq(documents.orgId, orgId)];
  if (opts.type) conditions.push(eq(documents.type, opts.type));
  if (opts.status && opts.status !== "all") {
    conditions.push(eq(documents.status, opts.status as Document["status"]));
  }
  if (opts.clientId) conditions.push(eq(documents.clientId, opts.clientId));
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(ilike(documents.number, term), ilike(clients.name, term))!
    );
  }

  const query = db
    .select({
      doc: documents,
      clientName: clients.name,
    })
    .from(documents)
    .leftJoin(clients, eq(documents.clientId, clients.id))
    .where(and(...conditions))
    .orderBy(desc(documents.issueDate), desc(documents.createdAt));

  const rows = opts.limit ? await query.limit(opts.limit) : await query;
  return rows.map((r) => ({ ...r.doc, clientName: r.clientName }));
}

export interface RelatedDocument {
  id: string;
  number: string;
  type: Document["type"];
  issueDate: string | null;
}

export interface FullDocument {
  document: Document;
  client: Client | null;
  items: LineItem[];
  payments: Payment[];
  /** Credit/debit notes: the invoice they adjust. */
  related: RelatedDocument | null;
  /** Invoices: credit/debit notes issued against it, oldest first. */
  notes: Document[];
}

export async function getDocument(
  orgId: string,
  id: string
): Promise<FullDocument | null> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.id, id)))
    .limit(1);
  if (!doc) return null;

  const [client, items, pays, related, notes] = await Promise.all([
    doc.clientId
      ? db
          .select()
          .from(clients)
          .where(and(eq(clients.id, doc.clientId), eq(clients.orgId, orgId)))
          .limit(1)
      : Promise.resolve([]),
    db
      .select()
      .from(lineItems)
      .where(eq(lineItems.documentId, id))
      .orderBy(lineItems.position),
    db
      .select()
      .from(payments)
      .where(eq(payments.documentId, id))
      .orderBy(desc(payments.paidAt)),
    doc.relatedDocumentId
      ? db
          .select({ id: documents.id, number: documents.number, type: documents.type, issueDate: documents.issueDate })
          .from(documents)
          .where(and(eq(documents.id, doc.relatedDocumentId), eq(documents.orgId, orgId)))
          .limit(1)
      : Promise.resolve([]),
    doc.type === "invoice"
      ? db
          .select()
          .from(documents)
          .where(and(eq(documents.relatedDocumentId, id), eq(documents.orgId, orgId)))
          .orderBy(asc(documents.createdAt))
      : Promise.resolve([]),
  ]);

  return {
    document: doc,
    client: client[0] ?? null,
    items,
    payments: pays,
    related: related[0] ?? null,
    notes,
  };
}

/** Aggregated counts for tab badges (e.g. invoices by status). */
export async function documentCountsByStatus(
  orgId: string,
  type: DocumentType
): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: documents.status,
      count: sql<number>`count(*)::int`,
    })
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.type, type)))
    .groupBy(documents.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}
