"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { clients } from "@/server/db/schema";
import { requireOrgContext } from "@/server/auth/context";
import { assertCanCreateClient, PlanLimitError } from "@/server/billing/usage";
import { logActivity } from "@/server/activity";
import { clientSchema } from "@/lib/validators";

export interface ClientActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createClient(raw: unknown): Promise<ClientActionResult> {
  const ctx = await requireOrgContext();
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await assertCanCreateClient(ctx);
  } catch (e) {
    if (e instanceof PlanLimitError) return { ok: false, error: e.message };
    throw e;
  }

  const d = parsed.data;
  const [row] = await db
    .insert(clients)
    .values({
      orgId: ctx.org.id,
      name: d.name,
      companyName: d.companyName,
      contactName: d.contactName,
      email: d.email,
      phone: d.phone,
      website: d.website,
      addressLine1: d.addressLine1,
      addressLine2: d.addressLine2,
      city: d.city,
      state: d.state,
      postalCode: d.postalCode,
      country: d.country,
      taxId: d.taxId,
      currency: d.currency,
      taxRate: d.taxRate !== undefined ? String(d.taxRate) : null,
      notes: d.notes,
      tags: d.tags ?? [],
    })
    .returning();

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "client.created",
    entityType: "client",
    entityId: row.id,
    description: `Added client ${row.name}`,
  });

  revalidatePath("/clients");
  return { ok: true, id: row.id };
}

export async function updateClient(
  id: string,
  raw: unknown
): Promise<ClientActionResult> {
  const ctx = await requireOrgContext();
  const parsed = clientSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  const [row] = await db
    .update(clients)
    .set({
      name: d.name,
      companyName: d.companyName,
      contactName: d.contactName,
      email: d.email,
      phone: d.phone,
      website: d.website,
      addressLine1: d.addressLine1,
      addressLine2: d.addressLine2,
      city: d.city,
      state: d.state,
      postalCode: d.postalCode,
      country: d.country,
      taxId: d.taxId,
      currency: d.currency,
      taxRate: d.taxRate !== undefined ? String(d.taxRate) : null,
      notes: d.notes,
      tags: d.tags ?? [],
      updatedAt: new Date(),
    })
    .where(and(eq(clients.id, id), eq(clients.orgId, ctx.org.id)))
    .returning();

  if (!row) return { ok: false, error: "Client not found." };

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, id };
}

export async function setClientStatus(
  id: string,
  status: "active" | "archived"
): Promise<ClientActionResult> {
  const ctx = await requireOrgContext();
  const [row] = await db
    .update(clients)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.orgId, ctx.org.id)))
    .returning();
  if (!row) return { ok: false, error: "Client not found." };

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: status === "archived" ? "client.archived" : "client.restored",
    entityType: "client",
    entityId: id,
    description: `${status === "archived" ? "Archived" : "Restored"} ${row.name}`,
  });

  revalidatePath("/clients");
  return { ok: true, id };
}
