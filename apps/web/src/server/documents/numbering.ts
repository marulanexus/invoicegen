import { eq } from "drizzle-orm";

import { businessProfiles, type Document } from "@/server/db/schema";

type DocType = Document["type"];

const PREFIX_FIELD = {
  invoice: "invoicePrefix",
  quote: "quotePrefix",
  receipt: "receiptPrefix",
  credit_note: "creditNotePrefix",
  debit_note: "debitNotePrefix",
} as const;

const COUNTER_FIELD = {
  invoice: "invoiceCounter",
  quote: "quoteCounter",
  receipt: "receiptCounter",
  credit_note: "creditNoteCounter",
  debit_note: "debitNoteCounter",
} as const;

/**
 * Reserve the next sequential number for a document type and atomically bump
 * the org's counter. MUST be called inside a transaction together with the
 * document insert so numbers are gap-free and never collide under concurrency.
 *
 * @param tx        an active Drizzle transaction
 * @param orgId     tenant id
 */
export async function reserveDocumentNumber(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  orgId: string,
  type: DocType
): Promise<string> {
  // Lock the profile row: without it two concurrent transactions read the
  // same counter and issue duplicate numbers (SARS needs unique serials).
  const [profile] = await tx
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.orgId, orgId))
    .limit(1)
    .for("update");

  if (!profile) {
    throw new Error("Business profile not found — complete onboarding first.");
  }

  const prefix = profile[PREFIX_FIELD[type]] as string;
  const current = profile[COUNTER_FIELD[type]] as number;
  const padded = String(current).padStart(profile.numberPadding ?? 4, "0");

  await tx
    .update(businessProfiles)
    .set({ [COUNTER_FIELD[type]]: current + 1, updatedAt: new Date() })
    .where(eq(businessProfiles.orgId, orgId));

  return `${prefix}${padded}`;
}
