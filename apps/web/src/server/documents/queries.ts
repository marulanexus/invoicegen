import "server-only";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

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

export interface FullDocument {
  document: Document;
  client: Client | null;
  items: LineItem[];
  payments: Payment[];
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

  const [client, items, pays] = await Promise.all([
    doc.clientId
      ? db.select().from(clients).where(eq(clients.id, doc.clientId)).limit(1)
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
  ]);

  return {
    document: doc,
    client: client[0] ?? null,
    items,
    payments: pays,
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
