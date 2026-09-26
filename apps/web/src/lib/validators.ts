import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

/* ─────────────────────────── Business profile ────────────────────────── */

export const businessProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Business name is required").max(120),
  legalName: optionalString,
  email: optionalEmail,
  phone: optionalString,
  website: optionalString,
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  country: optionalString,
  logoUrl: optionalString,
  brandColor: z.string().trim().optional().default("#2563eb"),
  defaultTemplateKey: z.string().trim().optional().default("classic"),
  taxId: optionalString,
  taxLabel: z.string().trim().optional().default("Tax"),
  defaultTaxRate: z.coerce.number().min(0).max(100).default(0),
  taxInclusive: z.boolean().optional().default(false),
  defaultCurrency: z.string().trim().length(3).default("USD"),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(14),
  invoicePrefix: z.string().trim().max(12).optional().default("INV-"),
  quotePrefix: z.string().trim().max(12).optional().default("QUO-"),
  receiptPrefix: z.string().trim().max(12).optional().default("REC-"),
  defaultNotes: optionalString,
  defaultTerms: optionalString,
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

/* ────────────────────────────── Clients ──────────────────────────────── */

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(160),
  companyName: optionalString,
  contactName: optionalString,
  email: optionalEmail,
  phone: optionalString,
  website: optionalString,
  addressLine1: optionalString,
  addressLine2: optionalString,
  city: optionalString,
  state: optionalString,
  postalCode: optionalString,
  country: optionalString,
  taxId: optionalString,
  currency: optionalString,
  taxRate: z.coerce.number().min(0).max(100).optional(),
  notes: optionalString,
  tags: z.array(z.string().trim()).optional().default([]),
});

export type ClientInput = z.infer<typeof clientSchema>;

/* ─────────────────────────────── Dates ───────────────────────────────── */

/** A real calendar date as `YYYY-MM-DD` (rejects e.g. 2026-02-31). */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "Enter a valid date");

/** Optional date: empty string and null both mean "not set". */
const optionalIsoDate = isoDate.or(z.literal("")).nullable().optional();

/* ────────────────────────────── Payments ─────────────────────────────── */

export const paymentSchema = z.object({
  documentId: z.string().uuid(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.enum(["cash", "bank_transfer", "card", "paypal", "stripe", "other"]),
  /** A date (`YYYY-MM-DD`) or a full ISO timestamp with offset, e.g. from a phone. */
  paidAt: isoDate.or(z.string().datetime({ offset: true })),
  reference: optionalString,
  notes: optionalString,
});

export type PaymentInput = z.infer<typeof paymentSchema>;

/* ───────────────────────────── Documents ─────────────────────────────── */

export const lineItemSchema = z.object({
  description: z.string().trim().max(500).default(""),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().default(0),
  discountRate: z.coerce.number().min(0).max(100).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export const documentSchema = z.object({
  type: z.enum(["invoice", "quote", "receipt"]),
  clientId: z.string().uuid().nullable().optional(),
  currency: z.string().trim().length(3).default("USD"),
  issueDate: isoDate,
  dueDate: optionalIsoDate,
  validUntil: optionalIsoDate,
  poNumber: optionalString,
  templateKey: z.string().default("classic"),
  accentColor: z.string().optional().default("#2563eb"),
  taxLabel: z.string().optional().default("Tax"),
  taxInclusive: z.boolean().optional().default(false),
  notes: optionalString,
  terms: optionalString,
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

export type DocumentInput = z.infer<typeof documentSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
