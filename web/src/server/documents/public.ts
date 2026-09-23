import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { clients, documents, lineItems, organizations } from "@/server/db/schema";
import { getPlan } from "@/lib/plans";
import { viewFromStored, type DocumentView } from "@/lib/document-view";

export interface PublicDocument {
  view: DocumentView;
  number: string;
  type: "invoice" | "quote" | "receipt";
}

/** Look up a document by its public share token (no auth / org scope). */
export async function getPublicDocument(
  token: string
): Promise<PublicDocument | null> {
  if (!token) return null;

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.publicToken, token))
    .limit(1);
  if (!doc || doc.status === "void") return null;

  const [items, [org]] = await Promise.all([
    db
      .select()
      .from(lineItems)
      .where(eq(lineItems.documentId, doc.id))
      .orderBy(lineItems.position),
    db
      .select()
      .from(organizations)
      .where(eq(organizations.id, doc.orgId))
      .limit(1),
  ]);

  // Backfill bill-to name if the snapshot is missing (older docs).
  if (!doc.billToSnapshot && doc.clientId) {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, doc.clientId))
      .limit(1);
    if (client) {
      doc.billToSnapshot = { name: client.name, email: client.email };
    }
  }

  const showPoweredBy = !getPlan(org?.plan).features.customBranding;
  return {
    view: viewFromStored(doc, items, { showPoweredBy }),
    number: doc.number,
    type: doc.type,
  };
}

/** Mark a sent document as viewed the first time its public link is opened. */
export async function markViewedByToken(token: string): Promise<void> {
  try {
    await db
      .update(documents)
      .set({ status: "viewed", viewedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(documents.publicToken, token), eq(documents.status, "sent")));
  } catch (err) {
    console.error("[public] markViewed failed", err);
  }
}
