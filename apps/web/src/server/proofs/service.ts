import "server-only";

import { randomUUID } from "node:crypto";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { amountOwed } from "@invoicegen/shared/calc";

import { db } from "@/server/db";
import { documents, paymentProofs, type PaymentProof } from "@/server/db/schema";
import type { OrgContext } from "@/server/auth/context";
import { logActivity } from "@/server/activity";
import { notifyProofReceived } from "@/server/notifications/events";
import { recordPaymentForOrg } from "@/server/payments/service";
import { fail, invalid, ok, type ServiceResult } from "@/server/service-result";
import { getPrivateFileUrl, uploadPrivateFile } from "@/server/storage";
import { MAX_PROOF_BYTES, safeFileName, sniffProofFile } from "@/server/proofs/files";
import { isPrivateStorageConfigured } from "@/lib/env";
import { formatCurrency, toMoneyString } from "@/lib/money";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Proof of payment: the payer uploads their EFT proof on the public invoice
 * link; the owner reviews it and, on accepting, a payment is recorded through
 * the normal payment rules (no overpaying, row locks, status updates).
 */

/** Pending proofs allowed per invoice, so a public link can't fill storage. */
const MAX_PENDING_PER_DOCUMENT = 10;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");

const submitFields = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0").max(1_000_000_000).optional(),
  paidOn: isoDate.optional(),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
});

/** Empty form fields mean "not given". */
function blankToUndefined(raw: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === "" || v === null ? undefined : v]));
}

/** Public: a payer uploads proof for the invoice behind a share link. */
export async function submitProofByToken(
  publicToken: string,
  file: { name: string; size: number; bytes: Uint8Array },
  rawFields: Record<string, unknown>
): Promise<ServiceResult<{ id: string }>> {
  const rl = rateLimit(`proof:${publicToken}`, 5, 10 * 60_000);
  if (!rl.ok) return fail("rate_limited", "Too many uploads. Please wait a few minutes and try again.");
  if (!isPrivateStorageConfigured) return fail("conflict", "Uploads aren't available for this invoice.");

  const fields = submitFields.safeParse(blankToUndefined(rawFields));
  if (!fields.success) return invalid(fields.error);

  const [doc] = await db.select().from(documents).where(eq(documents.publicToken, publicToken)).limit(1);
  if (!doc || doc.type !== "invoice" || doc.status === "void" || doc.status === "draft") {
    return fail("not_found", "Invoice not found.");
  }
  if (amountOwed(doc) <= 0) return fail("conflict", "This invoice is already paid.");

  if (file.size > MAX_PROOF_BYTES) return fail("validation", "That file is too big (5 MB max).", { file: ["Max 5 MB"] });
  const type = sniffProofFile(file.bytes);
  if (!type) {
    return fail("validation", "Upload a PDF or a photo (JPG, PNG, WebP or HEIC).", { file: ["Unsupported file type"] });
  }

  const [{ pending }] = await db
    .select({ pending: count() })
    .from(paymentProofs)
    .where(and(eq(paymentProofs.documentId, doc.id), eq(paymentProofs.status, "pending")));
  if (pending >= MAX_PENDING_PER_DOCUMENT) {
    return fail("conflict", "This invoice already has several proofs waiting to be checked. Please contact the business.");
  }

  const id = randomUUID();
  const key = await uploadPrivateFile(`pop/${doc.orgId}/${doc.id}/${id}.${type.ext}`, Buffer.from(file.bytes), type.contentType);
  if (!key) return fail("conflict", "Uploads aren't available for this invoice.");

  const d = fields.data;
  await db.insert(paymentProofs).values({
    id,
    orgId: doc.orgId,
    documentId: doc.id,
    fileKey: key,
    fileName: safeFileName(file.name, type.ext),
    contentType: type.contentType,
    size: file.size,
    amount: d.amount !== undefined ? toMoneyString(d.amount) : null,
    paidOn: d.paidOn ?? null,
    reference: d.reference ?? null,
    note: d.note ?? null,
  });

  await logActivity({
    orgId: doc.orgId,
    action: "proof.received",
    entityType: "document",
    entityId: doc.id,
    description: `Proof of payment received for ${doc.number}${d.amount !== undefined ? ` (${formatCurrency(d.amount, doc.currency)})` : ""}`,
  });
  notifyProofReceived(doc.orgId, {
    documentId: doc.id,
    number: doc.number,
    amount: d.amount !== undefined ? formatCurrency(d.amount, doc.currency) : null,
    clientName: typeof doc.billToSnapshot?.name === "string" ? (doc.billToSnapshot.name as string) : null,
  });

  return ok({ id });
}

export async function listProofs(orgId: string, documentId: string): Promise<PaymentProof[]> {
  return db
    .select()
    .from(paymentProofs)
    .where(and(eq(paymentProofs.orgId, orgId), eq(paymentProofs.documentId, documentId)))
    .orderBy(desc(paymentProofs.createdAt));
}

async function findProof(ctx: OrgContext, id: string) {
  const [proof] = await db
    .select()
    .from(paymentProofs)
    .where(and(eq(paymentProofs.id, id), eq(paymentProofs.orgId, ctx.org.id)))
    .limit(1);
  return proof ?? null;
}

/** A 5-minute link to view the uploaded file (private bucket). */
export async function proofFileUrlForOrg(ctx: OrgContext, id: string): Promise<ServiceResult<{ url: string }>> {
  const proof = await findProof(ctx, id);
  if (!proof) return fail("not_found", "Proof not found.");
  const url = await getPrivateFileUrl(proof.fileKey, 300);
  if (!url) return fail("conflict", "File storage isn't configured.");
  return ok({ url });
}

const acceptSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  paidAt: isoDate,
  method: z.enum(["bank_transfer", "cash", "card", "other"]).default("bank_transfer"),
  reference: z.string().trim().max(100).optional(),
});

/** Accept a proof: record the payment (normal rules apply) and link it. */
export async function acceptProofForOrg(
  ctx: OrgContext,
  id: string,
  raw: unknown
): Promise<ServiceResult<{ proof: PaymentProof }>> {
  const parsed = acceptSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);

  // Claim the proof first so two reviewers can't both record a payment.
  const [claimed] = await db
    .update(paymentProofs)
    .set({ status: "accepted", reviewedByMemberId: ctx.member.id, reviewedAt: new Date() })
    .where(and(eq(paymentProofs.id, id), eq(paymentProofs.orgId, ctx.org.id), eq(paymentProofs.status, "pending")))
    .returning();
  if (!claimed) {
    return (await findProof(ctx, id)) ? fail("conflict", "This proof has already been reviewed.") : fail("not_found", "Proof not found.");
  }

  const d = parsed.data;
  const payment = await recordPaymentForOrg(ctx, {
    documentId: claimed.documentId,
    amount: d.amount,
    method: d.method,
    paidAt: d.paidAt,
    reference: d.reference ?? claimed.reference ?? undefined,
    notes: "From proof of payment",
  });
  if (!payment.ok) {
    // Put it back so it can be reviewed again.
    await db
      .update(paymentProofs)
      .set({ status: "pending", reviewedByMemberId: null, reviewedAt: null })
      .where(eq(paymentProofs.id, id));
    return payment;
  }

  const [proof] = await db
    .update(paymentProofs)
    .set({ paymentId: payment.data.payment.id })
    .where(eq(paymentProofs.id, id))
    .returning();
  return ok({ proof });
}

const rejectSchema = z.object({ reason: z.string().trim().min(3, "Say why it's rejected").max(300) });

export async function rejectProofForOrg(
  ctx: OrgContext,
  id: string,
  raw: unknown
): Promise<ServiceResult<{ proof: PaymentProof }>> {
  const parsed = rejectSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);

  const [proof] = await db
    .update(paymentProofs)
    .set({ status: "rejected", rejectionReason: parsed.data.reason, reviewedByMemberId: ctx.member.id, reviewedAt: new Date() })
    .where(and(eq(paymentProofs.id, id), eq(paymentProofs.orgId, ctx.org.id), eq(paymentProofs.status, "pending")))
    .returning();
  if (!proof) {
    return (await findProof(ctx, id)) ? fail("conflict", "This proof has already been reviewed.") : fail("not_found", "Proof not found.");
  }

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "proof.rejected",
    entityType: "document",
    entityId: proof.documentId,
    description: `Rejected a proof of payment: ${parsed.data.reason}`,
  });
  return ok({ proof });
}
