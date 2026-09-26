"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import { sendDocumentForOrg, type SendInput } from "@/server/documents/sending";

// Thin web wrapper: the send flow lives in ./sending.ts (shared with /api/v1).

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendDocument(id: string, input: SendInput): Promise<SendResult> {
  const ctx = await requireOrgContext();
  const res = await sendDocumentForOrg(ctx, id, input);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath(`/documents/${id}`);
  revalidatePath(`/${res.data.type}s`);
  return { ok: true };
}
