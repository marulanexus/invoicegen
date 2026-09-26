import type { BusinessProfile, Document } from "@/server/db/schema";

/**
 * Pure document rules (no DB), used by ./service.ts and unit-tested directly.
 */

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Fill fields the caller left out from the business profile, the way the web
 * builder pre-fills its form (currency, tax, template, notes, due date…).
 * Used by the API so a phone can create a correct ZAR/VAT invoice from just a
 * client and line items. Fields that are present are never overridden.
 */
export function withProfileDefaults(
  raw: unknown,
  profile: BusinessProfile | null,
  today: Date = new Date()
): unknown {
  if (!profile || typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  const r = raw as Record<string, unknown>;
  const or = <T>(key: string, fallback: T) => (r[key] === undefined ? fallback : r[key]);

  const issueDate = or("issueDate", today.toISOString().slice(0, 10));
  const dueDate =
    r.dueDate === undefined && r.type === "invoice" && typeof issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(issueDate)
      ? addDays(issueDate, profile.paymentTermsDays)
      : r.dueDate;

  const lineItems = Array.isArray(r.lineItems)
    ? r.lineItems.map((li) =>
        typeof li === "object" && li !== null && (li as Record<string, unknown>).taxRate === undefined
          ? { ...li, taxRate: Number(profile.defaultTaxRate ?? 0) }
          : li
      )
    : r.lineItems;

  return {
    ...r,
    currency: or("currency", profile.defaultCurrency),
    issueDate,
    dueDate,
    templateKey: or("templateKey", profile.defaultTemplateKey),
    accentColor: or("accentColor", profile.brandColor ?? undefined),
    taxLabel: or("taxLabel", profile.taxLabel ?? undefined),
    taxInclusive: or("taxInclusive", profile.taxInclusive),
    notes: or("notes", profile.defaultNotes ?? undefined),
    terms: or("terms", profile.defaultTerms ?? undefined),
    lineItems,
  };
}

export const STATUS_ACTIONS = ["send", "mark_paid", "void", "accept", "decline", "reopen"] as const;
export type StatusAction = (typeof STATUS_ACTIONS)[number];

/** Why `action` can't apply to `doc` right now, or null when it can. */
export function statusActionBlocked(doc: Document, action: StatusAction): string | null {
  switch (action) {
    case "send":
      return doc.status === "draft" ? null : "Only drafts can be marked as sent.";
    case "mark_paid":
      if (doc.type === "quote") return "Quotes can't be marked as paid.";
      return doc.status === "paid" || doc.status === "void"
        ? `A ${doc.status} document can't be marked as paid.`
        : null;
    case "accept":
    case "decline":
      return doc.type === "quote" ? null : "Only quotes can be accepted or declined.";
    case "reopen":
      return doc.status === "draft" ? "This document is already a draft." : null;
    case "void":
      return doc.status === "void" ? "This document is already void." : null;
  }
}
