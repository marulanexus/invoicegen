import { eq } from "drizzle-orm";

import { businessProfiles } from "@/server/db/schema";

type DocType = "invoice" | "quote" | "receipt";

const PREFIX_FIELD = {
  invoice: "invoicePrefix",
  quote: "quotePrefix",
  receipt: "receiptPrefix",
} as const;

const COUNTER_FIELD = {
  invoice: "invoiceCounter",
  quote: "quoteCounter",
  receipt: "receiptCounter",
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
  const [profile] = await tx
    .select()
    .from(businessProfiles)
    .where(eq(businessProfiles.orgId, orgId))
    .limit(1);

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
