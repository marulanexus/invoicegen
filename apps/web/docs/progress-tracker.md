# Progress Tracker — InvoiceGen

Last updated: **2026-06-12** · Build status: ✅ `next build` passing ·
`tsc --noEmit` clean · landing/pricing serve 200, auth gate verified.

Legend: ✅ done & verified · 🟡 partial (schema/logic exists, UI pending) ·
⬜ not started.

---

## Phase 1 — Foundation ✅

| Item | Status | Notes |
| --- | --- | --- |
| Next.js 16 + TS strict + App Router scaffold | ✅ | `src/` dir, alias `@/*` |
| Tailwind v4 design system + tokens | ✅ | `globals.css` (oklch palette, dark mode) |
| shadcn-style UI primitives | ✅ | button, card, input, textarea, label, select, dialog, dropdown, tabs, switch, badge, separator, skeleton, table, sonner |
| Env management + graceful degradation | ✅ | `src/lib/env.ts`, `.env.example` |
| Dark mode (no-flash) | ✅ | `theme-provider.tsx`, `theme-toggle.tsx` |

## Phase 2 — Database & domain core ✅

| Item | Status | Notes |
| --- | --- | --- |
| Full Drizzle schema (17 tables) | ✅ | `src/server/db/schema.ts` |
| Lazy Neon pool + transactions | ✅ | `src/server/db/index.ts` |
| Money/calc/format/plans/templates libs | ✅ | `src/lib/*` |
| Migrations generated | ✅ | `drizzle/0000_*.sql` |
| Seed script | ✅ | `npm run db:seed` (demo org) |

## Phase 3 — Auth & tenancy ✅

| Item | Status | Notes |
| --- | --- | --- |
| Clerk middleware + route protection | ✅ | `src/middleware.ts` |
| Org context auto-provisioning | ✅ | `server/auth/context.ts` |
| Plan-limit enforcement + usage | ✅ | `server/billing/usage.ts` |

## Phase 4 — App shell & marketing ✅

| Item | Status | Notes |
| --- | --- | --- |
| Marketing landing + pricing | ✅ | hero, features, steps, pricing, FAQ |
| Clerk sign-in / sign-up pages | ✅ | graceful "not configured" fallback |
| Dashboard shell (sidebar + topbar) | ✅ | responsive drawer, plan card, user button |

## Phase 5 — Onboarding ✅

| Item | Status | Notes |
| --- | --- | --- |
| 4-step business setup wizard | ✅ | identity → address → tax/numbering → defaults |
| Seeds reminder + email settings | ✅ | on completion |

## Phase 6 — Clients CRM ✅

| Item | Status | Notes |
| --- | --- | --- |
| Client CRUD + plan limit | ✅ | `server/clients/*` |
| List w/ search + per-client stats | ✅ | outstanding/paid/doc count |
| Detail page + archive/restore | ✅ | documents, tags, notes |

## Phase 7 — Documents (core flow) ✅

| Item | Status | Notes |
| --- | --- | --- |
| Unified builder + live preview | ✅ | `document-builder.tsx` |
| Line items (qty/rate/disc/tax) | ✅ | tax-inclusive supported |
| Templates + accent color | ✅ | 4 built-in templates |
| Atomic numbering (transaction) | ✅ | `reserveDocumentNumber` |
| Status transitions | ✅ | draft/sent/paid/partial/overdue/void/accepted/declined |
| Invoice/Quote/Receipt lists | ✅ | shared list screen + filters |
| Detail page | ✅ | preview + summary + actions |

## Phase 8 — PDF & email ✅

| Item | Status | Notes |
| --- | --- | --- |
| A4 PDF (matches preview) | ✅ | `server/pdf/document-pdf.tsx` |
| PDF download route | ✅ | `/api/documents/[id]/pdf` |
| Send via SMTP / Resend + attachment | ✅ | `server/email/*`, send dialog |
| SMTP password encryption | ✅ | `src/lib/crypto.ts` |

## Phase 9 — Dashboard, payments, billing, settings, automations ✅

| Item | Status | Notes |
| --- | --- | --- |
| Dashboard metrics + revenue chart | ✅ | Recharts area chart, quick actions |
| Payments record/list + auto status | ✅ | `server/payments/actions.ts` |
| Settings: business / email / billing / team | ✅ | tabbed |
| Stripe checkout + portal + webhook | ✅ | `server/billing/*`, webhook route |
| Calendar (due dates + expiries) | ✅ | month grid + nav |
| Reminders/overdue cron | ✅ | `/api/cron/reminders` + `vercel.json` |
| README + docs | ✅ | this `docs/` set |

---

## Phase 10 — Feature completion (2026-06-12) ✅

Delivered in the "complete all missing features" pass; build + 34 unit tests +
typecheck all green, and audited by a supervisor review agent (findings fixed).

| Item | Status | Notes |
| --- | --- | --- |
| Quote → Invoice conversion | ✅ | `convertQuoteToInvoice` (txn, numbering, snapshots) + menu action |
| Recurring invoices | ✅ | create dialog, manage list (`/invoices/recurring`), cron generator with per-cycle durable progress |
| Activity-log viewer | ✅ | `/settings/activity` timeline + `listActivity` |
| Email template editor | ✅ | `/settings/templates`; send flow uses stored templates + interpolation (HTML-escaped) |
| Public share view + viewed tracking | ✅ | `/p/[token]`, public PDF route, token on send, sent→viewed |
| Global command palette (⌘K) | ✅ | cross-entity search, tenant-scoped |
| Dashboard reminders widget + chart toggle | ✅ | upcoming/overdue card + monthly/quarterly toggle |
| Clients archived filter UI | ✅ | Active/Archived/All chips |
| Custom default template config | ✅ | `business_profiles.defaultTemplateKey` + settings picker |
| Logo upload + PDF storage | ✅ | Cloudflare R2: public bucket (logos), private bucket (PDFs); graceful no-op when unconfigured |
| Rate limiting | ✅ | `src/lib/rate-limit.ts` on send/upload/public-PDF |
| Team invite/remove | ✅ | Clerk `OrganizationSwitcher` (manage modal) on Business plan |
| Advanced reporting (Business) | ✅ | `/reports`: revenue by client/status, A/R aging |
| Unit test suite | ✅ | Vitest: calc, money, plans (34 tests) |

## Deferred / backlog 🟡⬜

| Item | Status | Detail |
| --- | --- | --- |
| Google Calendar sync | ⬜ | env placeholders + `calendar_events.googleEventId` reserved |
| E2E tests (Playwright) | ⬜ | unit tests done; create→send happy path still manual |
| Distributed rate limiting | 🟡 | in-memory limiter is per-instance; swap for Upstash at scale |
| Reminder counter | 🟡 | cron logs to `reminder_log`; could also bump `usage_counters.remindersSent` |
| `calendar_events` tasks UI | 🟡 | table exists; calendar shows due dates/expiries, not user tasks |

---

## Suggested next milestones

1. **Quote → Invoice convert** (small, high value): clone accepted quote into a
   draft invoice.
2. **Recurring invoices**: generator job reading `recurring_invoices.payload`,
   driven by the existing cron route.
3. **Activity-log page** under `/settings` or `/dashboard`.
4. **Logo upload** via Vercel Blob, replacing the URL field.
5. **Test harness**: Vitest for `lib/calc` + `lib/money`, Playwright for the
   create→send happy path.
