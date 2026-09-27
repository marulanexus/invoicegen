/**
 * InvoiceGen database schema (Drizzle ORM / Postgres / Neon).
 *
 * Multi-tenancy: every business record is scoped to an `organizations` row,
 * which mirrors a Clerk Organization. Users belong to an org via `members`
 * (seats). All money is stored as `numeric(14,2)` (exact decimal) and handled
 * as strings at the DB boundary — see `src/lib/money.ts` for safe arithmetic.
 */

import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
  type AnyPgColumn,
  uuid,
} from "drizzle-orm/pg-core";

/* ───────────────────────────── Enums ─────────────────────────────────── */

export const planEnum = pgEnum("plan", ["free", "growth", "business"]);

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "member",
]);

export const clientStatusEnum = pgEnum("client_status", ["active", "archived"]);

export const documentTypeEnum = pgEnum("document_type", [
  "invoice",
  "quote",
  "receipt",
  /** Reduces an issued invoice (VAT Act s21(3)(a)). */
  "credit_note",
  /** Increases an issued invoice (VAT Act s21(3)(b)). */
  "debit_note",
]);

/** Superset of statuses across all document types. */
export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "sent",
  "viewed",
  "partial",
  "paid",
  "overdue",
  "void",
  "accepted", // quotes
  "declined", // quotes
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "bank_transfer",
  "card",
  "paypal",
  "stripe",
  "other",
  "payfast",
  "yoco",
]);

/** Online payment providers a business can connect to take invoice payments. */
export const gatewayProviderEnum = pgEnum("gateway_provider", ["payfast", "yoco"]);

export const checkoutStatusEnum = pgEnum("checkout_status", [
  "pending",
  "completed",
  "failed",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "incomplete",
  "unpaid",
]);

export const recurringFrequencyEnum = pgEnum("recurring_frequency", [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const emailProviderEnum = pgEnum("email_provider", ["platform", "smtp"]);

export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "due",
  "reminder",
  "task",
]);

/* ─────────────────────────── Organizations ───────────────────────────── */

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkOrgId: text("clerk_org_id").notNull().unique(),
  name: text("name").notNull(),
  plan: planEnum("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** 1:1 business profile — populated by the onboarding wizard. */
export const businessProfiles = pgTable("business_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),

  legalName: text("legal_name"),
  displayName: text("display_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),

  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country"),

  logoUrl: text("logo_url"),
  brandColor: text("brand_color").default("#2563eb"),
  defaultTemplateKey: text("default_template_key").notNull().default("classic"),
  defaultFooter: text("default_footer"),

  /** Registered VAT vendor: only vendors may issue (and charge VAT on) tax invoices. */
  vatRegistered: boolean("vat_registered").notNull().default(false),
  taxId: text("tax_id"),
  taxLabel: text("tax_label").default("Tax"),
  defaultTaxRate: numeric("default_tax_rate", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  taxInclusive: boolean("tax_inclusive").notNull().default(false),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  paymentTermsDays: integer("payment_terms_days").notNull().default(14),

  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  quotePrefix: text("quote_prefix").notNull().default("QUO-"),
  receiptPrefix: text("receipt_prefix").notNull().default("REC-"),
  invoiceCounter: integer("invoice_counter").notNull().default(1),
  quoteCounter: integer("quote_counter").notNull().default(1),
  receiptCounter: integer("receipt_counter").notNull().default(1),
  creditNotePrefix: text("credit_note_prefix").notNull().default("CN-"),
  creditNoteCounter: integer("credit_note_counter").notNull().default(1),
  debitNotePrefix: text("debit_note_prefix").notNull().default("DN-"),
  debitNoteCounter: integer("debit_note_counter").notNull().default(1),
  numberPadding: integer("number_padding").notNull().default(4),

  defaultNotes: text("default_notes"),
  defaultTerms: text("default_terms"),

  onboardingCompleted: boolean("onboarding_completed")
    .notNull()
    .default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Org membership / seats — mirrors Clerk org members. */
export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    role: memberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("members_org_user_idx").on(t.orgId, t.clerkUserId)]
);

/* ─────────────────────────────── Clients ─────────────────────────────── */

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),

  name: text("name").notNull(), // primary display name (company or person)
  companyName: text("company_name"),
  contactName: text("contact_name"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),

  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country"),

  taxId: text("tax_id"),
  /** Per-client overrides (fall back to business profile defaults when null). */
  currency: text("currency"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }),

  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>().default([]),
  status: clientStatusEnum("status").notNull().default("active"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ────────────────────────────── Documents ────────────────────────────── */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),

    type: documentTypeEnum("type").notNull(),
    number: text("number").notNull(), // e.g. INV-0001
    status: documentStatusEnum("status").notNull().default("draft"),

    currency: text("currency").notNull().default("USD"),
    issueDate: date("issue_date").notNull().defaultNow(),
    dueDate: date("due_date"),
    validUntil: date("valid_until"), // quotes

    // Snapshotted billing addresses so historic docs never change
    billToSnapshot: jsonb("bill_to_snapshot").$type<Record<string, unknown>>(),
    fromSnapshot: jsonb("from_snapshot").$type<Record<string, unknown>>(),

    // Monetary totals (computed from line items at save time)
    subtotal: numeric("subtotal", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    discountTotal: numeric("discount_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    taxTotal: numeric("tax_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    total: numeric("total", { precision: 14, scale: 2 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    /**
     * Invoices only: debit notes minus credit notes issued against it. What's
     * owed is total + adjustmentTotal − amountPaid; `total` never changes
     * once issued (see server/documents/notes.ts).
     */
    adjustmentTotal: numeric("adjustment_total", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    /** Credit/debit notes: the invoice they adjust. */
    relatedDocumentId: uuid("related_document_id").references((): AnyPgColumn => documents.id, {
      onDelete: "restrict",
    }),
    /** Credit/debit notes: why it was issued (s21(3)(a)(vi)). */
    reason: text("reason"),

    taxLabel: text("tax_label").default("Tax"),
    taxInclusive: boolean("tax_inclusive").notNull().default(false),
    poNumber: text("po_number"),

    templateKey: text("template_key").notNull().default("classic"),
    accentColor: text("accent_color").default("#2563eb"),

    notes: text("notes"),
    terms: text("terms"),

    /** R2 key of the last sent PDF, in the private bucket (never a public URL). */
    pdfKey: text("pdf_key"),
    publicToken: text("public_token"), // for shareable view links

    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),

    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
      { onDelete: "set null" }
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("documents_org_number_idx").on(t.orgId, t.number)]
);

export const lineItems = pgTable("line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  description: text("description").notNull().default(""),
  quantity: numeric("quantity", { precision: 12, scale: 3 })
    .notNull()
    .default("1"),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  /** Per-line discount and tax, expressed as percentages. */
  discountRate: numeric("discount_rate", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
});

/* ────────────────────────────── Payments ─────────────────────────────── */

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  method: paymentMethodEnum("method").notNull().default("bank_transfer"),
  reference: text("reference"),
  notes: text("notes"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  recordedByMemberId: uuid("recorded_by_member_id").references(
    () => members.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ──────────────────────── Subscriptions & usage ──────────────────────── */

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  plan: planEnum("plan").notNull().default("free"),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  seats: integer("seats").notNull().default(1),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Monthly usage counters for plan-limit enforcement & reporting. */
export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    periodStart: date("period_start").notNull(), // first day of month
    documentsCreated: integer("documents_created").notNull().default(0),
    remindersSent: integer("reminders_sent").notNull().default(0),
    emailsSent: integer("emails_sent").notNull().default(0),
  },
  (t) => [
    uniqueIndex("usage_org_period_idx").on(t.orgId, t.periodStart),
  ]
);

/* ────────────────────────── Templates & automation ───────────────────── */

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => organizations.id, {
    onDelete: "cascade",
  }), // null = system template
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const recurringInvoices = pgTable("recurring_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  frequency: recurringFrequencyEnum("frequency").notNull().default("monthly"),
  interval: integer("interval").notNull().default(1),
  nextRunDate: date("next_run_date").notNull(),
  endDate: date("end_date"),
  active: boolean("active").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  /** Snapshot of the invoice to clone each cycle (line items, notes, etc). */
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reminderSettings = pgTable("reminder_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(false),
  /** Days relative to due date to send (negative = before, positive = after). */
  schedule: jsonb("schedule").$type<number[]>().notNull().default([-3, 1, 7]),
  ccBusiness: boolean("cc_business").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reminderLog = pgTable("reminder_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  offsetDays: integer("offset_days").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ───────────────────────── Email configuration ───────────────────────── */

export const emailSettings = pgTable("email_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  provider: emailProviderEnum("provider").notNull().default("platform"),
  fromName: text("from_name"),
  fromEmail: text("from_email"),
  replyTo: text("reply_to"),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  smtpUser: text("smtp_user"),
  /** Encrypted at rest via src/lib/crypto.ts before storage. */
  smtpPasswordEnc: text("smtp_password_enc"),
  smtpSecure: boolean("smtp_secure").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // invoice | quote | receipt | reminder
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("email_templates_org_kind_idx").on(t.orgId, t.kind)]
);

/* ─────────────────────── Activity log & calendar ─────────────────────── */

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  actorMemberId: uuid("actor_member_id").references(() => members.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(), // e.g. "invoice.sent"
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: calendarEventTypeEnum("type").notNull().default("task"),
  eventDate: date("event_date").notNull(),
  documentId: uuid("document_id").references(() => documents.id, {
    onDelete: "cascade",
  }),
  notes: text("notes"),
  completed: boolean("completed").notNull().default(false),
  googleEventId: text("google_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* ─────────────────────────── Online payments ─────────────────────────── */

/**
 * A business's own merchant account with a payment provider. Invoice payments
 * go straight to the business, never through InvoiceGen. Secrets are stored
 * encrypted (`src/lib/crypto.ts`) as a JSON blob; see server/gateways/store.ts.
 */
export const paymentGateways = pgTable(
  "payment_gateways",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: gatewayProviderEnum("provider").notNull(),
    /** "test" (PayFast sandbox / Yoco test keys) or "live". */
    mode: text("mode").notNull().default("test"),
    enabled: boolean("enabled").notNull().default(true),
    /** PayFast merchant ID (not secret; shown in settings). */
    merchantId: text("merchant_id"),
    secretsEnc: text("secrets_enc").notNull(),
    /** Yoco webhook registered on the business's account for this gateway. */
    webhookId: text("webhook_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("payment_gateways_org_provider_idx").on(t.orgId, t.provider)]
);

/**
 * One "Pay now" attempt. Created before redirecting the payer to the provider;
 * completed exactly once by a verified provider notification, which records
 * the payment. Its id is the reference sent to the provider.
 */
export const paymentCheckouts = pgTable(
  "payment_checkouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    gatewayId: uuid("gateway_id").references(() => paymentGateways.id, { onDelete: "set null" }),
    provider: gatewayProviderEnum("provider").notNull(),
    mode: text("mode").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    status: checkoutStatusEnum("status").notNull().default("pending"),
    /** Provider's id for the checkout (Yoco checkout id). */
    providerReference: text("provider_reference"),
    /** Provider's id for the completed payment (PayFast pf_payment_id, Yoco payment id). */
    providerPaymentId: text("provider_payment_id"),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("payment_checkouts_document_idx").on(t.documentId),
    index("payment_checkouts_provider_ref_idx").on(t.provider, t.providerReference),
  ]
);

/* ──────────────────────────── Push devices ──────────────────────────── */

/**
 * A signed-in phone that receives push notifications (Expo push token). A
 * token belongs to one member at a time; re-registering moves it.
 */
export const pushDevices = pgTable(
  "push_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("push_devices_token_idx").on(t.token), index("push_devices_org_idx").on(t.orgId)]
);

/* ─────────────────────────────── Relations ───────────────────────────── */

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(members),
  clients: many(clients),
  documents: many(documents),
  profile: one(businessProfiles, {
    fields: [organizations.id],
    references: [businessProfiles.orgId],
  }),
  subscription: one(subscriptions, {
    fields: [organizations.id],
    references: [subscriptions.orgId],
  }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  org: one(organizations, {
    fields: [clients.orgId],
    references: [organizations.id],
  }),
  documents: many(documents),
  payments: many(payments),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  org: one(organizations, {
    fields: [documents.orgId],
    references: [organizations.id],
  }),
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.id],
  }),
  lineItems: many(lineItems),
  payments: many(payments),
}));

export const lineItemsRelations = relations(lineItems, ({ one }) => ({
  document: one(documents, {
    fields: [lineItems.documentId],
    references: [documents.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  document: one(documents, {
    fields: [payments.documentId],
    references: [documents.id],
  }),
  client: one(clients, {
    fields: [payments.clientId],
    references: [clients.id],
  }),
}));

/* ──────────────────────── Inferred TS types ──────────────────────────── */

export type Organization = typeof organizations.$inferSelect;
export type BusinessProfile = typeof businessProfiles.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type LineItem = typeof lineItems.$inferSelect;
export type NewLineItem = typeof lineItems.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type UsageCounter = typeof usageCounters.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type RecurringInvoice = typeof recurringInvoices.$inferSelect;
export type EmailSettings = typeof emailSettings.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type PaymentGateway = typeof paymentGateways.$inferSelect;
export type PaymentCheckout = typeof paymentCheckouts.$inferSelect;
export type PushDevice = typeof pushDevices.$inferSelect;
