import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { clients, type Client } from "@/server/db/schema";
import type { OrgContext } from "@/server/auth/context";
import { assertCanCreateClient, PlanLimitError } from "@/server/billing/usage";
import { logActivity } from "@/server/activity";
import { fail, invalid, ok, type ServiceResult } from "@/server/service-result";
import { clientSchema, type ClientInput } from "@/lib/validators";

/**
 * Client business rules, shared by the web server actions and `/api/v1`.
 * Callers resolve `ctx` (the tenant) first; every query here is scoped to it.
 */

function toColumns(d: ClientInput) {
  return {
    name: d.name,
    companyName: d.companyName ?? null,
    contactName: d.contactName ?? null,
    email: d.email ?? null,
    phone: d.phone ?? null,
    website: d.website ?? null,
    addressLine1: d.addressLine1 ?? null,
    addressLine2: d.addressLine2 ?? null,
    city: d.city ?? null,
    state: d.state ?? null,
    postalCode: d.postalCode ?? null,
    country: d.country ?? null,
    taxId: d.taxId ?? null,
    currency: d.currency ?? null,
    taxRate: d.taxRate !== undefined ? String(d.taxRate) : null,
    notes: d.notes ?? null,
    tags: d.tags ?? [],
  };
}

export async function createClientForOrg(
  ctx: OrgContext,
  raw: unknown
): Promise<ServiceResult<Client>> {
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);

  try {
    await assertCanCreateClient(ctx);
  } catch (e) {
    if (e instanceof PlanLimitError) return fail("plan_limit", e.message);
    throw e;
  }

  const [row] = await db
    .insert(clients)
    .values({ orgId: ctx.org.id, ...toColumns(parsed.data) })
    .returning();

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "client.created",
    entityType: "client",
    entityId: row.id,
    description: `Added client ${row.name}`,
  });

  return ok(row);
}

export async function updateClientForOrg(
  ctx: OrgContext,
  id: string,
  raw: unknown
): Promise<ServiceResult<Client>> {
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);

  const [row] = await db
    .update(clients)
    .set({ ...toColumns(parsed.data), updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.orgId, ctx.org.id)))
    .returning();

  if (!row) return fail("not_found", "Client not found.");
  return ok(row);
}

export async function setClientStatusForOrg(
  ctx: OrgContext,
  id: string,
  status: "active" | "archived"
): Promise<ServiceResult<Client>> {
  const [row] = await db
    .update(clients)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.orgId, ctx.org.id)))
    .returning();
  if (!row) return fail("not_found", "Client not found.");

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: status === "archived" ? "client.archived" : "client.restored",
    entityType: "client",
    entityId: id,
    description: `${status === "archived" ? "Archived" : "Restored"} ${row.name}`,
  });

  return ok(row);
}
