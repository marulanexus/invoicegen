# Environment Setup — Step by Step

This guide walks you through every environment variable InvoiceGen uses: what it
does, where to get it, and where to paste it — for both **local development** and
**production (Vercel)**.

> InvoiceGen degrades gracefully. The public marketing site builds and runs with
> **zero** configuration. You only need a few variables to sign in and use the
> app; the rest unlock optional integrations.

---

## 0. The 3 tiers of variables

| Tier | Variables | Without them |
| --- | --- | --- |
| **Required to use the app** | `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | You can browse the marketing site, but can't sign in or store data |
| **Required for production** | `APP_ENCRYPTION_KEY` | App throws on boot in production (dev uses a fallback key) |
| **Optional integrations** | Stripe, Resend, Vercel Blob, Cron, Google | Those features show a "not configured" notice and the rest keeps working |

---

## 1. Create your local env file

From the project root:

```powershell
# Windows PowerShell
Copy-Item .env.example .env.local
```

```bash
# macOS / Linux
cp .env.example .env.local
```

`.env.local` is git-ignored — your secrets stay on your machine. You'll fill it
in as you go below.

---

## 2. App basics

### `NEXT_PUBLIC_APP_URL`
The public base URL of your app. Used to build share links and Stripe redirect
URLs.

- **Local:** `http://localhost:3000`
- **Production:** `https://your-domain.com`

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### `APP_ENCRYPTION_KEY` (required in production)
A 32-byte key used to encrypt stored SMTP passwords at rest (AES-256-GCM).

Generate one:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-character hex string into:

```
APP_ENCRYPTION_KEY=PASTE_64_HEX_CHARS_HERE
```

> In development the app falls back to an insecure derived key if this is unset,
> so you can skip it locally. **Production requires it** or the app won't boot.

---

## 3. Database — Neon Postgres (REQUIRED)

InvoiceGen stores all data in Postgres via Drizzle.

1. Go to **https://neon.tech** and sign up (free tier is fine).
2. Click **Create project** → choose a region close to you.
3. On the project dashboard, open **Connection Details**.
4. Select the **Pooled connection** string and copy it. It looks like:
   `postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
5. Paste it into `.env.local`:

```
DATABASE_URL=postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
```

6. Create the database tables (run once, and again whenever the schema changes):

```powershell
npm run db:push        # pushes the Drizzle schema to Neon
# optional:
npm run db:seed        # inserts demo data for exploring
npm run db:studio      # opens a visual DB browser
```

> Tip: In production, use a **separate Neon project or branch** from development.

---

## 4. Authentication — Clerk (REQUIRED to sign in)

1. Go to **https://dashboard.clerk.com** and create an application.
2. Choose your sign-in methods (Email + Google/social, etc.).
3. In the left sidebar, open **API Keys**.
4. Copy the two keys into `.env.local`:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxx
```

5. (Defaults already wired — only set these if you customize the routes:)

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

6. **Team seats (optional):** Business Plus uses Clerk **Organizations**. In
   Clerk, go to **Organizations** and enable them so the in-app
   "Manage organization" UI can invite/remove members.

### `CLERK_WEBHOOK_SECRET` (optional / reserved)
Not required — InvoiceGen auto-provisions each user's workspace on first sign-in.
This variable is reserved for future Clerk → app sync. Leave blank unless you add
a Clerk webhook handler.

✅ **At this point you can run the app:**

```powershell
npm run dev
```
Visit http://localhost:3000, sign up, complete onboarding, and create an invoice.

---

## 5. Billing — Stripe (OPTIONAL: needed for paid plans)

Without Stripe, the Billing page shows "not configured" and everyone stays on
the Free plan. To enable Growth Pro / Business Plus:

### 5a. Get your API keys
1. Go to **https://dashboard.stripe.com** (use **Test mode** while developing).
2. Open **Developers → API keys**.
3. Copy:

```
STRIPE_SECRET_KEY=sk_test_xxxxxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxx
```

### 5b. Create the two products/prices
1. Go to **Product catalog → Add product**.
2. Create **Growth Pro** with a **recurring monthly** price (e.g. $18/mo).
3. Create **Business Plus** with a recurring monthly price (e.g. $32/mo).
4. Open each price and copy its **Price ID** (`price_...`):

```
STRIPE_PRICE_GROWTH=price_xxxxxxxx
STRIPE_PRICE_BUSINESS=price_xxxxxxxx
```

### 5c. Set up the webhook
The webhook keeps subscription status and plan in sync. The handler lives at
`/api/webhooks/stripe` and listens for:
`checkout.session.completed`, `customer.subscription.created`,
`customer.subscription.updated`, `customer.subscription.deleted`.

**Local testing (Stripe CLI):**
1. Install the Stripe CLI: **https://stripe.com/docs/stripe-cli**
2. Run:
   ```powershell
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
3. The CLI prints a signing secret (`whsec_...`). Put it in `.env.local`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxx
   ```

**Production:**
1. In Stripe, go to **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://your-domain.com/api/webhooks/stripe`
3. Select the four events listed above.
4. Copy the endpoint's **Signing secret** into your Vercel env as
   `STRIPE_WEBHOOK_SECRET`.

---

## 6. Email — Resend (OPTIONAL: platform default sender)

Used to email invoices/quotes/receipts. If you skip this, users can still
configure their **own SMTP** in Settings → Email; if neither is set, sending
returns a clear "no email transport configured" message.

1. Go to **https://resend.com** and sign up.
2. Open **API Keys → Create API Key** and copy it.
3. (Recommended) Verify your sending **domain** under **Domains**.
4. Add to env:

```
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=InvoiceGen <invoices@yourdomain.com>
```

> `EMAIL_FROM` must use a domain you've verified in Resend.

---

## 7. File storage — Vercel Blob (OPTIONAL: logo upload & PDF archiving)

Without this, you can still paste a logo **URL**, and PDFs are generated on
demand (just not stored).

1. In your **Vercel** project, go to **Storage → Create → Blob**.
2. Create a store and copy its **Read/Write token**.
3. Add to env:

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxx
```

On Vercel, linking the Blob store to your project sets this automatically.

---

## 8. Automations — Cron (OPTIONAL but recommended)

A daily job at `/api/cron/reminders` flags overdue invoices, sends reminders, and
generates due recurring invoices. It's scheduled in `vercel.json`.

### `CRON_SECRET`
Protects the endpoint with a bearer token.

```powershell
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

```
CRON_SECRET=PASTE_RANDOM_STRING_HERE
```

- On **Vercel**, add `CRON_SECRET` to env; Vercel Cron automatically sends it.
- **Security note:** in production the endpoint **fails closed** — if
  `CRON_SECRET` is unset, requests are rejected (401).
- Trigger it manually to test:
  ```powershell
  curl.exe -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/reminders
  ```

---

## 9. Google Calendar (OPTIONAL / future)

Reserved for an upcoming calendar-sync integration. Leave blank unless/until that
feature ships.

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## 10. Deploying to Vercel

1. Push the repo to GitHub and **Import** it into Vercel.
2. Go to **Project → Settings → Environment Variables** and add every value from
   your `.env.local` (use **production** values — live Stripe keys, production
   Neon branch, your real domain in `NEXT_PUBLIC_APP_URL`).
3. Add `APP_ENCRYPTION_KEY` (required in production) and `CRON_SECRET`.
4. Point the Stripe webhook at `https://your-domain.com/api/webhooks/stripe`.
5. Run `npm run db:push` against the production database once.
6. Deploy. The cron in `vercel.json` registers automatically.

> Set variables for the correct **Environments** (Production / Preview /
> Development) in Vercel. Anything prefixed `NEXT_PUBLIC_` is exposed to the
> browser — never put secrets behind that prefix.

---

## 11. Quick reference

| Variable | Required? | Source | Used for |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Recommended | You | Share links, Stripe redirects |
| `APP_ENCRYPTION_KEY` | Prod only | `node` command | Encrypt SMTP passwords |
| `DATABASE_URL` | ✅ Yes | Neon | All data |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ Yes | Clerk | Auth (client) |
| `CLERK_SECRET_KEY` | ✅ Yes | Clerk | Auth (server) |
| `CLERK_WEBHOOK_SECRET` | Optional | Clerk | Reserved |
| `STRIPE_SECRET_KEY` | Optional | Stripe | Billing |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | Stripe | Billing (client) |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe CLI / Dashboard | Sync subscriptions |
| `STRIPE_PRICE_GROWTH` | Optional | Stripe | Growth plan price |
| `STRIPE_PRICE_BUSINESS` | Optional | Stripe | Business plan price |
| `RESEND_API_KEY` | Optional | Resend | Platform email |
| `EMAIL_FROM` | Optional | You (verified domain) | Sender address |
| `BLOB_READ_WRITE_TOKEN` | Optional | Vercel Blob | Logo upload, PDF storage |
| `CRON_SECRET` | Optional | `node` command | Protect cron job |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional | Google Cloud | Future calendar sync |

---

## 12. Verify your setup

```powershell
npm run typecheck     # types are sound
npm run test          # unit tests pass
npm run build         # production build succeeds
npm run dev           # run locally → http://localhost:3000
```

If the app boots but a feature shows "not configured", that integration's env
vars are missing — revisit the matching section above.

### Common issues
- **"DATABASE_URL is not set"** → add `DATABASE_URL` to `.env.local` and restart `npm run dev`.
- **Sign-in page says "not configured"** → add the two Clerk keys.
- **Billing shows "not configured"** → add Stripe keys + price IDs.
- **Emails fail** → add `RESEND_API_KEY` + verified `EMAIL_FROM`, or configure SMTP in Settings → Email.
- **Env changes not taking effect** → restart the dev server; Next.js only reads `.env.local` at startup.
