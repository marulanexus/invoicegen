"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import {
  createClientForOrg,
  setClientStatusForOrg,
  updateClientForOrg,
} from "@/server/clients/service";

// Thin web wrappers: business rules live in ./service.ts (shared with /api/v1).

export interface ClientActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createClient(raw: unknown): Promise<ClientActionResult> {
  const ctx = await requireOrgContext();
  const res = await createClientForOrg(ctx, raw);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath("/clients");
  return { ok: true, id: res.data.id };
}

export async function updateClient(
  id: string,
  raw: unknown
): Promise<ClientActionResult> {
  const ctx = await requireOrgContext();
  const res = await updateClientForOrg(ctx, id, raw);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, id };
}

export async function setClientStatus(
  id: string,
  status: "active" | "archived"
): Promise<ClientActionResult> {
  const ctx = await requireOrgContext();
  const res = await setClientStatusForOrg(ctx, id, status);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/clients");
  return { ok: true, id };
}
