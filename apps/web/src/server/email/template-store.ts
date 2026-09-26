import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/server/db";
import { emailTemplates } from "@/server/db/schema";
import {
  DEFAULT_EMAIL_TEMPLATES,
  type EmailTemplateKind,
} from "@/server/email/templates";

export interface StoredTemplate {
  subject: string;
  body: string;
}

/** All four templates for an org, with defaults filled in for any not customized. */
export async function getEmailTemplates(
  orgId: string
): Promise<Record<EmailTemplateKind, StoredTemplate>> {
  const rows = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.orgId, orgId));

  const byKind = new Map(rows.map((r) => [r.kind, r]));
  const result = {} as Record<EmailTemplateKind, StoredTemplate>;
  (Object.keys(DEFAULT_EMAIL_TEMPLATES) as EmailTemplateKind[]).forEach((kind) => {
    const row = byKind.get(kind);
    result[kind] = row
      ? { subject: row.subject, body: row.body }
      : DEFAULT_EMAIL_TEMPLATES[kind];
  });
  return result;
}

/** A single template (custom if present, else default). */
export async function getEmailTemplate(
  orgId: string,
  kind: EmailTemplateKind
): Promise<StoredTemplate> {
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(and(eq(emailTemplates.orgId, orgId), eq(emailTemplates.kind, kind)))
    .limit(1);
  return row
    ? { subject: row.subject, body: row.body }
    : DEFAULT_EMAIL_TEMPLATES[kind];
}
