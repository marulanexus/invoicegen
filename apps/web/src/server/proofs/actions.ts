"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { acceptProofForOrg, proofFileUrlForOrg, rejectProofForOrg } from "@/server/proofs/service";

// Thin web wrappers: rules live in ./service.ts (shared with /api/v1).

export interface ProofActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function acceptProof(id: string, documentId: string, raw: unknown): Promise<ProofActionResult> {
  const ctx = await requireOrgContext();
  const res = await acceptProofForOrg(ctx, id, raw);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function rejectProof(id: string, documentId: string, raw: unknown): Promise<ProofActionResult> {
  const ctx = await requireOrgContext();
  const res = await rejectProofForOrg(ctx, id, raw);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };
  revalidatePath(`/documents/${documentId}`);
  return { ok: true };
}

/** A short-lived link to view the uploaded file. */
export async function proofFileUrl(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const res = await proofFileUrlForOrg(ctx, id);
  return res.ok ? { ok: true, url: res.data.url } : { ok: false, error: res.error };
}
