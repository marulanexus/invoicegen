"use server";

import { and, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/server/db";
import { clients, documents } from "@/server/db/schema";
import { requireOrgContext } from "@/server/auth/context";

export interface SearchResults {
  clients: { id: string; name: string; email: string | null }[];
  documents: {
    id: string;
    number: string;
    type: "invoice" | "quote" | "receipt";
    status: string;
    total: string;
    currency: string;
    clientName: string | null;
  }[];
}

/** Cross-entity search for the command palette. Tenant-scoped. */
export async function globalSearch(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.length < 1) return { clients: [], documents: [] };

  const ctx = await requireOrgContext();
  const term = `%${q}%`;

  const [clientRows, docRows] = await Promise.all([
    db
      .select({ id: clients.id, name: clients.name, email: clients.email })
      .from(clients)
      .where(
        and(
          eq(clients.orgId, ctx.org.id),
          or(
            ilike(clients.name, term),
            ilike(clients.companyName, term),
            ilike(clients.email, term)
          )
        )
      )
      .limit(6),
    db
      .select({
        id: documents.id,
        number: documents.number,
        type: documents.type,
        status: documents.status,
        total: documents.total,
        currency: documents.currency,
        clientName: clients.name,
      })
      .from(documents)
      .leftJoin(clients, eq(documents.clientId, clients.id))
      .where(
        and(
          eq(documents.orgId, ctx.org.id),
          or(ilike(documents.number, term), ilike(clients.name, term))
        )
      )
      .orderBy(desc(documents.createdAt))
      .limit(8),
  ]);

  return { clients: clientRows, documents: docRows };
}
