"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/server/db";
import {
  businessProfiles,
  emailSettings,
  organizations,
  reminderSettings,
} from "@/server/db/schema";
import { requireOrgContext } from "@/server/auth/context";
import { logActivity } from "@/server/activity";
import { businessProfileSchema } from "@/lib/validators";

export interface ActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function completeOnboarding(
  raw: unknown
): Promise<ActionResult> {
  const ctx = await requireOrgContext();
  const parsed = businessProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  const values = {
    orgId: ctx.org.id,
    displayName: data.displayName,
    legalName: data.legalName,
    email: data.email,
    phone: data.phone,
    website: data.website,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    city: data.city,
    state: data.state,
    postalCode: data.postalCode,
    country: data.country,
    logoUrl: data.logoUrl,
    brandColor: data.brandColor,
    taxId: data.taxId,
    vatRegistered: data.vatRegistered,
    taxLabel: data.taxLabel,
    defaultTaxRate: String(data.defaultTaxRate),
    taxInclusive: data.taxInclusive,
    defaultCurrency: data.defaultCurrency,
    paymentTermsDays: data.paymentTermsDays,
    invoicePrefix: data.invoicePrefix,
    quotePrefix: data.quotePrefix,
    receiptPrefix: data.receiptPrefix,
    defaultNotes: data.defaultNotes,
    defaultTerms: data.defaultTerms,
    onboardingCompleted: true,
    updatedAt: new Date(),
  };

  await db
    .insert(businessProfiles)
    .values(values)
    .onConflictDoUpdate({ target: businessProfiles.orgId, set: values });

  // Keep the org's display name in sync.
  await db
    .update(organizations)
    .set({ name: data.displayName, updatedAt: new Date() })
    .where(eq(organizations.id, ctx.org.id));

  // Seed sensible automation defaults (idempotent).
  await db
    .insert(reminderSettings)
    .values({ orgId: ctx.org.id })
    .onConflictDoNothing({ target: reminderSettings.orgId });
  await db
    .insert(emailSettings)
    .values({
      orgId: ctx.org.id,
      provider: "platform",
      fromName: data.displayName,
      fromEmail: data.email,
    })
    .onConflictDoNothing({ target: emailSettings.orgId });

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "business.onboarded",
    description: `${data.displayName} completed business setup`,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
