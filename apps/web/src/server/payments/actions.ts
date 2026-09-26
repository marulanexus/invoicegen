"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { deletePaymentForOrg, recordPaymentForOrg } from "@/server/payments/service";

// Thin web wrappers: business rules live in ./service.ts (shared with /api/v1).

export interface PaymentActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function recordPayment(raw: unknown): Promise<PaymentActionResult> {
  const ctx = await requireOrgContext();
  const res = await recordPaymentForOrg(ctx, raw);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath("/payments");
  revalidatePath(`/documents/${res.data.document.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deletePayment(id: string): Promise<PaymentActionResult> {
  const ctx = await requireOrgContext();
  const res = await deletePaymentForOrg(ctx, id);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/payments");
  revalidatePath(`/documents/${res.data.documentId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
