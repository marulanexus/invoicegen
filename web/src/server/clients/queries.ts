import "server-only";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { clients, documents, type Client } from "@/server/db/schema";

export interface ClientStats {
  documentCount: number;
  outstanding: number;
  totalPaid: number;
}

export type ClientWithStats = Client & { stats: ClientStats };

export async function listClients(
  orgId: string,
  opts: { search?: string; status?: "active" | "archived" | "all" } = {}
): Promise<ClientWithStats[]> {
  const conditions = [eq(clients.orgId, orgId)];

  if (opts.status && opts.status !== "all") {
    conditions.push(eq(clients.status, opts.status));
  }
  if (opts.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(
        ilike(clients.name, term),
        ilike(clients.companyName, term),
        ilike(clients.email, term),
        ilike(clients.contactName, term)
      )!
    );
  }

  const rows = await db
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(desc(clients.createdAt));

  if (rows.length === 0) return [];

  // Aggregate document stats per client in one grouped query.
  const stats = await db
    .select({
      clientId: documents.clientId,
      documentCount: sql<number>`count(*)::int`,
      totalPaid: sql<string>`coalesce(sum(${documents.amountPaid}), 0)`,
      outstanding: sql<string>`coalesce(sum(case when ${documents.type} = 'invoice' and ${documents.status} in ('sent','viewed','partial','overdue') then ${documents.total} - ${documents.amountPaid} else 0 end), 0)`,
    })
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .groupBy(documents.clientId);

  const byClient = new Map(stats.map((s) => [s.clientId, s]));

  return rows.map((c) => {
    const s = byClient.get(c.id);
    return {
      ...c,
      stats: {
        documentCount: s?.documentCount ?? 0,
        outstanding: Number(s?.outstanding ?? 0),
        totalPaid: Number(s?.totalPaid ?? 0),
      },
    };
  });
}

export async function getClient(
  orgId: string,
  clientId: string
): Promise<Client | null> {
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.orgId, orgId), eq(clients.id, clientId)))
    .limit(1);
  return row ?? null;
}
