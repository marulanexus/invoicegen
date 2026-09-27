"use server";

import { revalidatePath } from "next/cache";

import { requireOrgContext } from "@/server/auth/context";
import {
  changeDocumentStatusForOrg,
  convertQuoteToInvoiceForOrg,
  createDocumentForOrg,
  deleteDocumentForOrg,
  getShareLinkForOrg,
  updateDocumentForOrg,
  type StatusAction,
} from "@/server/documents/service";
import { issueNoteForOrg } from "@/server/documents/notes";

// Thin web wrappers: business rules live in ./service.ts (shared with /api/v1).

export interface DocumentActionResult {
  ok: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function createDocument(raw: unknown): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();
  const res = await createDocumentForOrg(ctx, raw);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath("/documents");
  revalidatePath(`/${res.data.type}s`);
  return { ok: true, id: res.data.id };
}

export async function updateDocument(
  id: string,
  raw: unknown
): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();
  const res = await updateDocumentForOrg(ctx, id, raw);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { ok: true, id };
}

export async function changeDocumentStatus(
  id: string,
  action: StatusAction
): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();
  const res = await changeDocumentStatusForOrg(ctx, id, action);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { ok: true, id };
}

export async function deleteDocument(id: string): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();
  const res = await deleteDocumentForOrg(ctx, id);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/documents");
  revalidatePath(`/${res.data.type}s`);
  return { ok: true };
}

export async function convertQuoteToInvoice(
  quoteId: string
): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();
  const res = await convertQuoteToInvoiceForOrg(ctx, quoteId);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/invoices");
  revalidatePath("/quotes");
  revalidatePath(`/documents/${quoteId}`);
  return { ok: true, id: res.data.id };
}

/**
 * The public link to send the client. For a draft this issues it (SARS
 * checks, frozen details, marked sent), same as sharing from the phone.
 */
export async function shareDocument(
  id: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await requireOrgContext();
  const res = await getShareLinkForOrg(ctx, id);
  if (!res.ok) return { ok: false, error: res.error };

  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { ok: true, url: res.data.url };
}

/** Issue a credit or debit note against an issued invoice (VAT Act s21). */
export async function issueNote(
  invoiceId: string,
  raw: unknown
): Promise<DocumentActionResult> {
  const ctx = await requireOrgContext();
  const res = await issueNoteForOrg(ctx, invoiceId, raw);
  if (!res.ok) return { ok: false, error: res.error, fieldErrors: res.fieldErrors };

  revalidatePath("/invoices");
  revalidatePath(`/documents/${invoiceId}`);
  revalidatePath("/dashboard");
  return { ok: true, id: res.data.note.id };
}
