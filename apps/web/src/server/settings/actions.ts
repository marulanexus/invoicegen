"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/server/db";
import {
  businessProfiles,
  emailSettings,
  emailTemplates,
  organizations,
  reminderSettings,
} from "@/server/db/schema";
import { requireOrgContext } from "@/server/auth/context";
import { logActivity } from "@/server/activity";
import { encryptSecret } from "@/lib/crypto";
import { businessProfileSchema } from "@/lib/validators";

export interface SettingsResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function updateBusinessProfile(
  raw: unknown
): Promise<SettingsResult> {
  const ctx = await requireOrgContext();
  const parsed = businessProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  await db
    .update(businessProfiles)
    .set({
      displayName: d.displayName,
      legalName: d.legalName ?? null,
      email: d.email ?? null,
      phone: d.phone ?? null,
      website: d.website ?? null,
      addressLine1: d.addressLine1 ?? null,
      addressLine2: d.addressLine2 ?? null,
      city: d.city ?? null,
      state: d.state ?? null,
      postalCode: d.postalCode ?? null,
      country: d.country ?? null,
      logoUrl: d.logoUrl ?? null,
      brandColor: d.brandColor,
      defaultTemplateKey: d.defaultTemplateKey,
      taxId: d.taxId ?? null,
      vatRegistered: d.vatRegistered,
      taxLabel: d.taxLabel,
      defaultTaxRate: String(d.defaultTaxRate),
      taxInclusive: d.taxInclusive,
      defaultCurrency: d.defaultCurrency,
      paymentTermsDays: d.paymentTermsDays,
      invoicePrefix: d.invoicePrefix,
      quotePrefix: d.quotePrefix,
      receiptPrefix: d.receiptPrefix,
      defaultNotes: d.defaultNotes ?? null,
      defaultTerms: d.defaultTerms ?? null,
      updatedAt: new Date(),
    })
    .where(eq(businessProfiles.orgId, ctx.org.id));

  await db
    .update(organizations)
    .set({ name: d.displayName, updatedAt: new Date() })
    .where(eq(organizations.id, ctx.org.id));

  await logActivity({
    orgId: ctx.org.id,
    actorMemberId: ctx.member.id,
    action: "settings.business_updated",
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

const emailSettingsSchema = z
  .object({
    provider: z.enum(["platform", "smtp"]),
    fromName: z.string().trim().optional(),
    fromEmail: z
      .string()
      .trim()
      .email()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    replyTo: z
      .string()
      .trim()
      .email()
      .optional()
      .or(z.literal(""))
      .transform((v) => (v ? v : undefined)),
    smtpHost: z.string().trim().optional(),
    smtpPort: z.coerce.number().int().optional(),
    smtpUser: z.string().trim().optional(),
    smtpPassword: z.string().optional(),
    smtpSecure: z.boolean().optional().default(true),
  })
  .refine(
    (v) => v.provider !== "smtp" || (v.smtpHost && v.smtpUser),
    { message: "SMTP host and user are required", path: ["smtpHost"] }
  );

export async function updateEmailSettings(raw: unknown): Promise<SettingsResult> {
  const ctx = await requireOrgContext();
  const parsed = emailSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;

  const base = {
    provider: d.provider,
    fromName: d.fromName,
    fromEmail: d.fromEmail,
    replyTo: d.replyTo,
    smtpHost: d.smtpHost,
    smtpPort: d.smtpPort,
    smtpUser: d.smtpUser,
    smtpSecure: d.smtpSecure,
    // Only re-encrypt when a new password was provided.
    ...(d.smtpPassword
      ? { smtpPasswordEnc: encryptSecret(d.smtpPassword) }
      : {}),
  };

  await db
    .insert(emailSettings)
    .values({ orgId: ctx.org.id, ...base })
    .onConflictDoUpdate({ target: emailSettings.orgId, set: base });

  revalidatePath("/settings/email");
  return { ok: true };
}

const emailTemplateSchema = z.object({
  kind: z.enum(["invoice", "quote", "receipt", "reminder"]),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: z.string().trim().min(1, "Body is required").max(5000),
});

export async function updateEmailTemplate(raw: unknown): Promise<SettingsResult> {
  const ctx = await requireOrgContext();
  const parsed = emailTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please check the template.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;
  await db
    .insert(emailTemplates)
    .values({ orgId: ctx.org.id, kind: d.kind, subject: d.subject, body: d.body })
    .onConflictDoUpdate({
      target: [emailTemplates.orgId, emailTemplates.kind],
      set: { subject: d.subject, body: d.body, updatedAt: new Date() },
    });
  revalidatePath("/settings/templates");
  return { ok: true };
}

export async function updateReminderSettings(input: {
  enabled: boolean;
  schedule: number[];
}): Promise<SettingsResult> {
  const ctx = await requireOrgContext();
  const values = {
    orgId: ctx.org.id,
    enabled: input.enabled,
    schedule: input.schedule,
  };
  await db
    .insert(reminderSettings)
    .values(values)
    .onConflictDoUpdate({
      target: reminderSettings.orgId,
      set: { enabled: input.enabled, schedule: input.schedule },
    });
  revalidatePath("/settings/automations");
  return { ok: true };
}
