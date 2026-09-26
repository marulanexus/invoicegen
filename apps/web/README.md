# InvoiceGen

A modern, professional SaaS for **invoices, quotes and receipts** — built for freelancers, sole traders, consultants and small businesses. Create beautiful documents, send them as PDFs, track payments, and get paid faster.

> Core flow: **sign up → set up your business → add a client → build an invoice (live preview) → send a PDF → record payment.**

---

## Tech stack

| Concern        | Choice                                                            |
| -------------- | ---------------------------------------------------------------- |
| Framework      | **Next.js 16** (App Router, React Server Components, TS strict)   |
| Styling        | **Tailwind CSS v4** (CSS-first theme) + shadcn-style UI + Radix   |
| Database       | **Neon Postgres** + **Drizzle ORM** (WebSocket pool, real tx)    |
| Auth           | **Clerk** (multi-user / org seats)                               |
| Billing        | **Stripe** subscriptions (checkout, portal, webhooks)            |
| PDF            | **@react-pdf/renderer** (A4, server-rendered)                   |
| Email          | **Resend** (platform default) + **Nodemailer** (user SMTP)       |
| Charts         | **Recharts** · **Validation** Zod · **Toasts** Sonner            |
| Deploy         | **Vercel** (incl. cron for reminders)                            |

## Features

- **Onboarding wizard** — business identity, address, tax, currency, numbering.
- **Clients CRM** — full CRUD, tags, notes, per-client currency/tax, search, archive, history.
- **Unified documents** — invoices, quotes & receipts share one builder with a **live preview** that matches the PDF exactly.
- **Line items** — quantity, rate, per-line discount & tax, tax-inclusive mode, multi-currency.
- **Automatic, gap-free numbering** — atomic per-org counters inside DB transactions.
- **Beautiful PDFs** — logo, brand color, terms, templates; download or email with one click.
- **Email delivery** — your own SMTP or the platform default, with PDF attached.
- **Payments** — record partial/full payments; status auto-updates (draft → sent → partial → paid / overdue).
- **Dashboard** — revenue, outstanding, overdue, active clients + 6-month revenue chart + quick actions.
- **Calendar** — invoice due dates and quote expiries, month navigation.
- **Automations** — overdue flagging + scheduled reminders (cron).
- **Plans & limits** — Free / Growth Pro / Business Plus enforced in middleware-level helpers + Stripe.
- **Polish** — dark mode, mobile-first, accessible focus states, empty states, activity log.

## Project structure

```
src/
  app/
    (app)/                 # Authenticated dashboard (sidebar shell)
      dashboard/ clients/ invoices/ quotes/ receipts/
      payments/ calendar/ settings/ documents/
    api/
      documents/[id]/pdf/  # PDF download
      webhooks/stripe/     # Stripe webhook
      cron/reminders/      # Scheduled reminders + overdue marking
    sign-in/ sign-up/      # Clerk
    onboarding/            # First-run setup wizard
    page.tsx pricing/      # Marketing site
  components/
    ui/                    # shadcn-style primitives (button, card, dialog…)
    app/ documents/ clients/ settings/ dashboard/ form/  # feature UI
  lib/                     # env, money, calc, plans, templates, document-view, crypto…
  server/
    db/                    # Drizzle schema, client, seed
    auth/                  # Clerk → org context provisioning
    billing/               # usage limits, Stripe
    documents/ clients/ payments/ settings/ email/ pdf/   # queries + server actions
  middleware.ts            # Clerk route protection
```

## Getting started

### 1. Prerequisites
- Node 20+ and npm
- A [Neon](https://neon.tech) Postgres database (required)
- A [Clerk](https://clerk.com) application (required for sign-in)
- Optional: [Stripe](https://stripe.com), [Resend](https://resend.com)

### 2. Install & configure
```bash
npm install
cp .env.example .env.local   # then fill in values
```
Minimum to boot the app: `DATABASE_URL`, the two Clerk keys, and `APP_ENCRYPTION_KEY`
(generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
The public marketing site renders even before keys are added.

> 📑 **New here? Follow the [Environment Setup guide](./docs/environment-setup.md)** —
> a step-by-step walkthrough for getting every key from Neon, Clerk, Stripe,
> Resend, Cloudflare R2 and Cron, for both local dev and production.

### 3. Create the schema
```bash
npm run db:migrate   # apply SQL migrations in drizzle/ (never mix with db:push)
npm run db:seed      # optional: demo org with sample clients & documents
npm run db:studio    # optional: browse data in Drizzle Studio
```

### 4. Run
```bash
npm run dev          # http://localhost:3000
```

## Environment variables

**📖 Full step-by-step guide: [docs/environment-setup.md](./docs/environment-setup.md).**
See [`.env.example`](./.env.example) for the raw list. Highlights:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Neon pooled connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | ✅ | Auth |
| `APP_ENCRYPTION_KEY` | ✅ | 32-byte key encrypting stored SMTP passwords |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | ➖ | Paid plans |
| `RESEND_API_KEY`, `EMAIL_FROM` | ➖ | Platform email sending |
| `CRON_SECRET` | ➖ | Bearer token protecting the reminders cron |

## Plans & enforcement

Defined in [`src/lib/plans.ts`](./src/lib/plans.ts) and enforced in
[`src/server/billing/usage.ts`](./src/server/billing/usage.ts):

| Plan | Price | Clients | Docs / mo | Key features |
| --- | --- | --- | --- | --- |
| Free Starter | $0 | 3 | 5 | Basic templates |
| Growth Pro | $18 | ∞ | ∞ | Reminders + recurring |
| Business Plus | $32 | ∞ | ∞ | Team seats, custom branding, reporting |

Map `STRIPE_PRICE_GROWTH` / `STRIPE_PRICE_BUSINESS` to monthly recurring Prices in Stripe.

## Webhooks & cron

- **Stripe webhook** → `POST /api/webhooks/stripe` (set this URL in your Stripe dashboard; it syncs the subscription + plan).
- **Reminders cron** → `GET /api/cron/reminders` (scheduled daily 09:00 UTC via [`vercel.json`](./vercel.json); send `Authorization: Bearer $CRON_SECRET`).

## Deployment (Vercel)

1. Push to GitHub and import the repo into Vercel.
2. Add all env vars from `.env.example`.
3. Set the Stripe webhook endpoint to `https://<your-app>/api/webhooks/stripe`.
4. Run `npm run db:migrate` against your production database (on every schema change).
5. Deploy. The cron in `vercel.json` is registered automatically.

## Scripts

| Script | Description |
| --- | --- |
| `dev` / `build` / `start` | Next.js dev / production build / serve |
| `typecheck` | `tsc --noEmit` |
| `test` / `test:watch` | Run the Vitest unit suite |
| `db:push` | Throwaway/local databases only — skips migration history |
| `db:generate` / `db:migrate` | Generate & apply SQL migrations |
| `db:studio` | Open Drizzle Studio |
| `db:seed` | Seed demo data |

## Documentation

Full docs live in [`docs/`](./docs):

| Document | What it covers |
| --- | --- |
| [environment-setup.md](./docs/environment-setup.md) | **Start here** — step-by-step env var setup for every service |
| [architecture-context.md](./docs/architecture-context.md) | System architecture, request lifecycles, data model, security |
| [ui-context.md](./docs/ui-context.md) | Design system, components, screen-by-screen UI reference |
| [code-standards.md](./docs/code-standards.md) | Coding conventions and patterns |
| [ai-workflow-rules.md](./docs/ai-workflow-rules.md) | Rules for AI agents / contributors |
| [progress-tracker.md](./docs/progress-tracker.md) | Feature status and backlog |
| [MOU_System_Development_Plan.md](./docs/MOU_System_Development_Plan.md) | Formal development plan |
| [MOU_System_High_Level_Architecture.md](./docs/MOU_System_High_Level_Architecture.md) | Formal high-level architecture (with diagrams) |

---

Built as a cohesive, incrementally-extensible product. Core invoicing flow first; quotes, receipts, payments, automations, calendar and billing build on the same foundation.
