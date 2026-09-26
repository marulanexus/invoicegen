# InvoiceGen — System Development Plan

**Document:** MOU_System_Development_Plan
**Product:** InvoiceGen — Invoice, Quote & Receipt SaaS
**Version:** 1.0 · **Date:** 2026-06-12 · **Status:** Baseline (MVP delivered)
**Owner:** Engineering

---

## 1. Document control

| Version | Date | Author | Change |
| --- | --- | --- | --- |
| 0.1 | 2026-06-12 | Eng | Initial plan & scope |
| 1.0 | 2026-06-12 | Eng | MVP delivered; plan baselined with as-built status |

Related documents: `MOU_System_High_Level_Architecture.md`,
`architecture-context.md`, `code-standards.md`, `ui-context.md`,
`progress-tracker.md`, `ai-workflow-rules.md`.

---

## 2. Executive summary

InvoiceGen is a multi-tenant SaaS that lets freelancers, sole traders,
consultants, and small businesses create, send, and track invoices, quotes, and
receipts. The central value proposition is **fast, beautiful, effortless
invoicing from any device**. This plan covers objectives, scope, delivery
methodology, phased milestones, testing, deployment, and risk management. The
MVP (Phases 1–9) is **complete and build-verified**; remaining items are tracked
as backlog.

---

## 3. Objectives

| # | Objective | Success measure |
| --- | --- | --- |
| O1 | Create & send a professional invoice in under a minute | Builder + live preview + 1-click PDF email |
| O2 | Support invoices, quotes & receipts in one system | Unified document model & builder |
| O3 | Multi-tenant with team seats from day one | Org/member model + Clerk orgs |
| O4 | Tiered monetization (Free/Growth/Business) | Stripe subscriptions + enforced limits |
| O5 | Trustworthy, compliant billing | Sequential numbering, audit log, GDPR-friendly deletes |
| O6 | Excellent mobile experience | Mobile-first, responsive, tested at 380px |
| O7 | Deployable on Vercel with minimal ops | Serverless DB, cron, env-driven config |

---

## 4. Scope

### 4.1 In scope (MVP)
- Auth & onboarding (Clerk, business setup wizard).
- Clients CRM (CRUD, tags, notes, per-client currency/tax, search, archive).
- Documents: invoices, quotes, receipts — builder, live preview, line items,
  discounts/tax, multi-currency, templates, automatic numbering, statuses.
- PDF generation (A4) + email delivery (Resend / user SMTP).
- Payments (manual record, partial/full, auto status).
- Dashboard (metrics + revenue chart), Calendar (due dates/expiries).
- Settings (business profile, email/SMTP, billing, team).
- Billing (Stripe checkout/portal/webhooks) + plan-limit enforcement.
- Automations (overdue flagging + reminder cron).

### 4.2 Out of scope (backlog / future)
- Recurring-invoice generation UI/job, quote→invoice conversion.
- Google Calendar two-way sync; logo file upload to object storage.
- Advanced reporting; activity-log viewer UI; email-template editor.
- Online card payment by end-customers (Stripe Checkout for invoices).
- Automated test suite (planned, not in MVP).

### 4.3 Assumptions & constraints
- Hosted on **Vercel**; database on **Neon**; auth via **Clerk**.
- Strict tech stack (see HLA §6). Tailwind v4 (CSS-first), Next 16 App Router.
- Third-party keys are provided by the operator via environment variables.

---

## 5. Stakeholders

| Role | Interest |
| --- | --- |
| End users (freelancers/SMBs) | Fast invoicing, getting paid |
| Product owner | Feature scope, monetization |
| Engineering | Maintainability, correctness, security |
| Operations | Deployment, uptime, secrets management |
| Finance/Compliance | Numbering integrity, audit, data handling |

---

## 6. Delivery methodology

- **Incremental, vertical slices.** Build the core flow end-to-end first
  (auth → setup → invoice → PDF → email), then expand outward.
- **Type-safe by construction**: TS strict, Zod at boundaries, Drizzle schema as
  the single source of truth.
- **Continuous verification**: `tsc --noEmit` and `next build` are gates after
  each module; runtime smoke tests for critical paths.
- **Conventions enforced** via `ai-workflow-rules.md` and `code-standards.md`.

---

## 7. Phased plan, milestones & deliverables

| Phase | Milestone | Key deliverables | Status |
| --- | --- | --- | --- |
| 1 | Foundation | Scaffold, design system, env, dark mode | ✅ |
| 2 | Data core | 17-table Drizzle schema, lazy client, migrations, seed, money/calc libs | ✅ |
| 3 | Auth & tenancy | Clerk middleware, org provisioning, plan enforcement | ✅ |
| 4 | App shell & marketing | Landing, pricing, auth pages, sidebar shell | ✅ |
| 5 | Onboarding | Business setup wizard | ✅ |
| 6 | Clients CRM | CRUD, list, detail, archive | ✅ |
| 7 | Documents | Builder + live preview, lists, detail, numbering, statuses | ✅ |
| 8 | PDF & email | A4 PDF, download route, SMTP/Resend send | ✅ |
| 9 | Money & ops | Dashboard, payments, billing, settings, calendar, reminders, docs | ✅ |
| 10 | Hardening (next) | Tests, recurring invoices, quote→invoice, reporting | ⬜ |

Detailed status: `progress-tracker.md`.

---

## 8. Work breakdown (representative)

```
1. Platform
   1.1 Project scaffold, TS, Tailwind v4, UI primitives
   1.2 Env/config, encryption, lazy DB proxy
2. Data
   2.1 Schema + relations + enums
   2.2 Migrations, seed, calc/money/format libs
3. Identity
   3.1 Clerk middleware, org context, members
   3.2 Plans + usage limits
4. Product
   4.1 Onboarding wizard
   4.2 Clients (queries/actions/UI)
   4.3 Documents (numbering, builder, preview, lists, detail, statuses)
   4.4 PDF + email + send dialog
   4.5 Payments
   4.6 Dashboard + calendar
5. Monetization
   5.1 Stripe client/actions, checkout/portal
   5.2 Webhook sync, billing UI
6. Automation
   6.1 Reminder/overdue cron
7. Docs & QA
   7.1 README + docs set
   7.2 Build/type/runtime verification
```

---

## 9. Environments & tooling

| Environment | Purpose | Data |
| --- | --- | --- |
| Local | Development | Neon dev branch or local; `.env.local` |
| Preview (Vercel) | PR previews | Neon preview branch |
| Production (Vercel) | Live | Neon production branch |

Tooling: npm, Drizzle Kit (`db:push/generate/migrate/studio`), TypeScript,
ESLint, Next build.

---

## 10. Testing strategy

| Layer | Approach | Status |
| --- | --- | --- |
| Type safety | `tsc --noEmit` (gate) | ✅ enforced |
| Build integrity | `next build` (gate) | ✅ enforced |
| Runtime smoke | Landing/pricing 200, auth-gate redirect, sign-in fallback | ✅ done |
| Unit (planned) | Vitest on `lib/calc`, `lib/money`, numbering | ⬜ |
| Integration (planned) | Server actions against a test DB | ⬜ |
| E2E (planned) | Playwright: create → send → record payment | ⬜ |
| Manual QA | Mobile (380px), dark mode, empty/error states | ongoing |

**Critical test cases to add:** tax/discount math (incl. tax-inclusive), gap-free
numbering under concurrency, plan-limit enforcement, webhook plan sync,
payment→status transitions, PDF/preview parity.

---

## 11. Deployment & release plan

1. Provision Neon, Clerk, (optional) Stripe & Resend; collect keys.
2. Configure Vercel project env vars from `.env.example`.
3. `npm run db:push` against production DB (one-time / on schema change).
4. Set Stripe webhook endpoint to `/api/webhooks/stripe`; set `CRON_SECRET`.
5. Deploy via Vercel; cron auto-registers from `vercel.json`.
6. Smoke test: sign up → onboarding → create & send invoice → record payment.

**Rollback:** Vercel instant rollback to previous deployment; DB migrations are
additive — coordinate destructive changes with backups.

---

## 12. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- | --- |
| R1 | Invoice number collisions | Low | High | Transactional `reserveDocumentNumber` + unique `(orgId,number)` |
| R2 | Preview ≠ sent PDF | Med | High | Single `DocumentView` for preview/detail/PDF |
| R3 | Money rounding errors | Med | High | Centralized `calc`/`money`, integer-cent rounding |
| R4 | Build needs live DB | Med | Med | Lazy DB proxy; env degradation flags |
| R5 | Secret leakage (SMTP) | Low | High | AES-256-GCM at rest; webhook signature checks |
| R6 | Stripe/plan drift | Med | Med | Webhook is sole writer of `organizations.plan` |
| R7 | No automated tests | High | Med | Prioritize Vitest/Playwright in Phase 10 |
| R8 | Third-party outage | Low | Med | Graceful degradation + descriptive errors |

---

## 13. Acceptance criteria (MVP)

- [x] A new user can sign up, complete onboarding, and create/send an invoice.
- [x] PDF is professional A4 and matches the on-screen preview.
- [x] Payments update document status correctly (partial/paid/overdue).
- [x] Free plan limits (3 clients / 5 docs/month) are enforced.
- [x] Stripe upgrade path exists (when configured) with webhook sync.
- [x] App builds and type-checks cleanly; public site runs without secrets.
- [x] Responsive on mobile; dark mode supported.

---

## 14. Maintenance & support

- **Schema changes:** edit `schema.ts` → `db:generate` → `db:migrate`.
- **Dependencies:** periodic updates; watch Clerk/Stripe SDK majors.
- **Observability:** add structured logging/error tracking (e.g. Sentry) in
  Phase 10.
- **Docs:** keep `progress-tracker.md` and this plan current as scope evolves.
