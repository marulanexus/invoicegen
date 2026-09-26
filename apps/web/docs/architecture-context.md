# Architecture Context — InvoiceGen

A reference for how the system is structured and how a request flows through it.
Pair this with `MOU_System_High_Level_Architecture.md` (formal HLA) and
`code-standards.md` (conventions).

---

## 1. System overview

InvoiceGen is a **multi-tenant SaaS** for creating, sending, and tracking
invoices, quotes, and receipts. It is a single Next.js application (App Router)
that serves both the marketing site and the authenticated product, backed by a
serverless Postgres database and four third-party services.

```
                         ┌─────────────────────────────────────────┐
        Browser  ───────▶│            Next.js 16 (Vercel)           │
   (mobile-first SPA-ish)│  ┌────────────┐      ┌────────────────┐  │
                         │  │ RSC pages  │      │ Server Actions │  │
                         │  │ (read)     │      │ (mutations)    │  │
                         │  └─────┬──────┘      └───────┬────────┘  │
                         │        │   ┌──────────────┐  │           │
                         │        └──▶│ server/* svc │◀─┘           │
                         │            │ queries +    │              │
                         │            │ actions      │              │
                         │            └──────┬───────┘              │
                         │   Route handlers  │  (PDF, webhooks,cron)│
                         └───────────────────┼──────────────────────┘
                                             │
        ┌────────────┬───────────────┬───────┴───────┬───────────────┐
        ▼            ▼               ▼               ▼               ▼
     Clerk        Neon            Stripe          Resend /        @react-pdf
   (auth/orgs)  (Postgres)     (subscriptions)  user SMTP        (PDF render)
```

---

## 2. Layered structure

```
src/
├── app/                      # Routing layer (RSC pages + route handlers)
│   ├── (app)/                #   Authenticated product (sidebar shell)
│   ├── api/                  #   PDF download, Stripe webhook, reminders cron
│   ├── sign-in / sign-up     #   Clerk auth pages
│   ├── onboarding/           #   First-run wizard
│   └── page.tsx / pricing/   #   Public marketing
├── components/               # Presentation layer
│   ├── ui/                   #   Design-system primitives (Radix + cva)
│   └── <domain>/             #   Feature components
├── lib/                      # Pure, framework-agnostic logic (no DB)
└── server/                   # Application/data layer (server-only)
    ├── db/                   #   Drizzle schema, lazy client, seed
    ├── auth/                 #   Tenant resolution & provisioning
    ├── <domain>/             #   queries.ts (read) + actions.ts (write)
    ├── email/ pdf/ billing/  #   Integration adapters
```

**Dependency direction:** `app → components → lib` and
`app → server → lib`. `lib` depends on nothing internal except other `lib`.
`components` never import `server/*` (server-only) — data is passed as props.

---

## 3. Request lifecycles

### 3.1 Reading a page (e.g. `/invoices`)
1. `middleware.ts` (Clerk) authenticates and protects the route.
2. The RSC `page.tsx` calls `requireOrgContext()` → resolves tenant
   (cached per request).
3. It calls a `server/<domain>/queries.ts` function, scoped by `orgId`.
4. Server components render; client components hydrate for interactivity.

### 3.2 Mutating data (e.g. create invoice)
1. Client component calls a `"use server"` action inside `useTransition`.
2. Action: `requireOrgContext()` → Zod validate → plan check → **DB transaction**
   (reserve number + insert document + insert line items) → `logActivity` →
   `revalidatePath`.
3. Returns `{ ok, id }`; client navigates and `router.refresh()`.

### 3.3 PDF / email
- `GET /api/documents/[id]/pdf` → `getDocument` → `viewFromStored` →
  `renderDocumentPdf` (@react-pdf/renderer) → streams `application/pdf`.
- `sendDocument` action → renders the same PDF → `sendMail` (SMTP or Resend) with
  attachment → marks `sentAt`, increments usage, logs activity.

### 3.4 Billing (Stripe)
- `startCheckout(plan)` / `openBillingPortal()` create Stripe sessions and return
  a redirect URL.
- `POST /api/webhooks/stripe` verifies the signature and **is the source of truth**
  for `subscriptions` + `organizations.plan`.

### 3.5 Automations (cron)
- `GET /api/cron/reminders` (daily via `vercel.json`, bearer-protected): flags
  overdue invoices and sends scheduled reminders, de-duplicated via `reminder_log`.

---

## 4. Multi-tenancy model

- One **organization** per tenant (`organizations`), mirroring a Clerk org or a
  synthetic `user:<id>` personal workspace.
- All business rows carry `orgId` with `ON DELETE CASCADE`.
- `getOrgContext()` (`src/server/auth/context.ts`) lazily provisions the org,
  `members` row, and a free `subscriptions` row on first request, and returns
  `{ org, member, profile, plan, onboardingCompleted }`.
- Team seats: additional `members` rows; gated by `plan.features.multipleSeats`.

---

## 5. Data model (17 tables)

| Group | Tables |
| --- | --- |
| Tenancy | `organizations`, `business_profiles`, `members` |
| CRM | `clients` |
| Documents | `documents`, `line_items` |
| Money | `payments` |
| Billing/usage | `subscriptions`, `usage_counters` |
| Templates/automation | `templates`, `recurring_invoices`, `reminder_settings`, `reminder_log` |
| Email | `email_settings`, `email_templates` |
| System | `activity_logs`, `calendar_events` |

Key design points:
- **Money** = `numeric(14,2)`; surfaced as strings, computed via `@invoicegen/shared` (`calc`).
- **Snapshots**: `documents.fromSnapshot` / `billToSnapshot` (jsonb) freeze party
  details at issue time.
- **Numbering**: per-org counters on `business_profiles`
  (`invoiceCounter`/`quoteCounter`/`receiptCounter`) bumped atomically.
- **Unique indexes**: `(orgId, number)` on documents; `(orgId, clerkUserId)` on
  members; `(orgId, periodStart)` on usage counters.

Full schema: `src/server/db/schema.ts`. Generated SQL: `drizzle/`.

---

## 6. Integration points

| Service | Adapter | Configured via | Degradation when absent |
| --- | --- | --- | --- |
| **Clerk** (auth/orgs) | `middleware.ts`, `server/auth/context.ts` | `*_CLERK_*` | Public site only; `(app)` redirects to sign-in |
| **Neon** (Postgres) | `server/db/index.ts` (lazy pool) | `DATABASE_URL` | Build still works; first query throws helpfully |
| **Stripe** (billing) | `server/billing/*`, `api/webhooks/stripe` | `STRIPE_*` | Billing UI shows "not configured" |
| **Resend** (email) | `server/email/transport.ts` | `RESEND_API_KEY` | Falls back to user SMTP, else descriptive error |
| **Nodemailer** (SMTP) | same | per-org `email_settings` | Optional |

`src/lib/env.ts` centralizes access and exposes `isClerkConfigured`,
`isStripeConfigured`, `isResendConfigured`, etc.

---

## 7. Security model

- **AuthN/Z**: Clerk session at the edge (middleware) + `requireOrgContext()` in
  every server entry point. All queries are `orgId`-scoped.
- **Secrets at rest**: SMTP passwords encrypted with AES-256-GCM
  (`src/lib/crypto.ts`, `APP_ENCRYPTION_KEY`).
- **Webhook integrity**: Stripe signature verified with `STRIPE_WEBHOOK_SECRET`.
- **Cron**: bearer token (`CRON_SECRET`).
- **Input**: Zod validation on every action; SQL via Drizzle (parameterized).
- **Compliance posture**: sequential gap-free numbering, activity audit log,
  cascade deletes for data removal (GDPR-friendly).

---

## 8. Runtime & deployment

- **Runtime**: Node.js (PDF, webhooks, cron pin `runtime = "nodejs"`).
- **DB driver**: Neon **WebSocket pool** (`drizzle-orm/neon-serverless`) for real
  interactive transactions; `ws` provided in Node.
- **Hosting**: Vercel. Cron registered in `vercel.json`.
- **Build invariants**: import-time side effects avoided (lazy DB proxy,
  conditional ClerkProvider) so the app compiles without live services.

---

## 9. Key invariants (do not break)

1. Preview == PDF == stored totals (one `DocumentView`, one `calc`).
2. Invoice numbers are gap-free and unique per org (transactional reservation).
3. `organizations.plan` is written only by the Stripe webhook.
4. No tenant data leaves its `orgId`.
5. The public marketing site builds and runs with zero environment config.
