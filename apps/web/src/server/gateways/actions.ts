"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import {
  connectPayfastForOrg,
  connectYocoForOrg,
  disconnectGatewayForOrg,
} from "@/server/gateways/service";

// Thin web wrappers: rules live in ./service.ts.

export interface GatewayActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** Yoco only: false when the webhook couldn't be registered (e.g. localhost). */
  webhookRegistered?: boolean;
}

export async function connectPayfast(raw: unknown): Promise<GatewayActionResult> {
  const ctx = await requireOrgContext();
  const res = await connectPayfastForOrg(ctx, raw);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/settings/payments");
  return { ok: true };
}

export async function connectYoco(raw: unknown): Promise<GatewayActionResult> {
  const ctx = await requireOrgContext();
  const res = await connectYocoForOrg(ctx, raw);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath("/settings/payments");
  return { ok: true, webhookRegistered: res.data.webhookRegistered };
}

export async function disconnectGateway(provider: "payfast" | "yoco"): Promise<GatewayActionResult> {
  const ctx = await requireOrgContext();
  const res = await disconnectGatewayForOrg(ctx, provider);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/settings/payments");
  return { ok: true };
}
