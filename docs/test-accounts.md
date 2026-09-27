# Setting up test accounts

Some parts of InvoiceGen can only be tested with accounts that belong to you:
online payments (PayFast, Yoco), InvoiceGen's own rand subscriptions, and push
notifications on a real phone. This is the checklist. Everything here is
**test/sandbox only**; no real money moves.

Never commit keys. They go in `apps/web/.env.local` (git-ignored), or in the
app's Settings page for your customers' gateways.

---

## 1. A public HTTPS address (needed by everything below)

PayFast and Yoco confirm payments by calling your server (an ITN or webhook).
They can't reach `localhost`, so the web app needs a public HTTPS URL while you
test.

**Option A: Vercel preview (recommended).** Push the branch; Vercel builds a
preview at `https://<branch>-<project>.vercel.app`.

1. In Vercel, set the project's *Root Directory* to `apps/web`.
2. Add the same environment variables as your `.env.local` (Project → Settings →
   Environment Variables, scope *Preview*), and set `NEXT_PUBLIC_APP_URL` to the
   preview URL.
3. Sign in on the preview URL and test there.

**Option B: a tunnel to your computer.** With Cloudflare's free quick tunnel:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

It prints a `https://<random>.trycloudflare.com` address. Then:

1. Set `NEXT_PUBLIC_APP_URL` in `apps/web/.env.local` to that address and restart
   `npm run dev:web`. The address changes every time the tunnel restarts.
2. In `apps/web/next.config.ts`, add the host to `allowedDevOrigins` (so the dev
   server serves its assets there) and to `experimental.serverActions.allowedOrigins`
   (so forms and buttons work). Don't commit these; they're for your machine.
3. Open the app **through the tunnel address** and sign in there, so the
   payment pages send you back to a page where you're signed in.

---

## 2. PayFast sandbox (your customers' "Pay now" by card/EFT)

The shared sandbox merchant in PayFast's docs has someone else's passphrase,
so signatures from InvoiceGen won't verify with it. Use your own:

1. Register at <https://sandbox.payfast.co.za> (free).
2. In the sandbox dashboard, open **Settings** and set a **Salt Passphrase**.
3. Note your sandbox **Merchant ID** and **Merchant Key**.
4. In InvoiceGen (on the public URL from step 1): **Settings → Payments
   → PayFast**, enter the ID, key and passphrase, mode **Test**.
5. Open an unpaid invoice's share link, click **Pay now**, and pay with the
   sandbox's test card. The invoice should turn **Paid** within seconds (that's
   the ITN arriving).

## 3. Yoco test key (your customers' "Pay now" by card)

1. Sign in to the Yoco Business Portal and find the **developer / API keys**
   section. Copy the **test secret key** (it starts with `sk_test_`).
2. In InvoiceGen (on the public URL): **Settings → Payments → Yoco**,
   paste the key. InvoiceGen registers its webhook with Yoco for you.
3. Pay an invoice from its share link with one of Yoco's published test cards.
   The invoice should turn **Paid**.

## 4. InvoiceGen's own subscriptions (PayFast recurring billing)

This is Marula Nexus charging businesses R149 / R299 a month (or yearly). It
uses a PayFast merchant account **for Marula Nexus**, set in environment
variables, not in the app's Settings. The sandbox account from step 2 works for
testing.

In `apps/web/.env.local` (and Vercel):

```bash
PAYFAST_BILLING_MERCHANT_ID=<sandbox merchant id>
PAYFAST_BILLING_MERCHANT_KEY=<sandbox merchant key>
PAYFAST_BILLING_PASSPHRASE=<the salt passphrase>   # required for subscriptions
PAYFAST_BILLING_MODE=test
# BILLING_VAT_NUMBER=   leave empty until Marula Nexus is VAT-registered
```

Then, on the public URL: **Settings → Billing**, pick a plan and Monthly/Yearly,
and pay with the sandbox card. You should come back to Billing on the new plan,
with the payment under *Billing history*. **Cancel subscription** stops future
charges; the plan stays until the period ends and the daily job
(`/api/cron/reminders`) then moves the business to Free.

Before going live: create the live PayFast merchant account for Marula Nexus,
set a passphrase there too, swap in the live values, and set
`PAYFAST_BILLING_MODE=live`.

## 5. Mobile: EAS project and a development build

Expo Go runs most of the app, but push notifications need an EAS project (both
platforms), and on Android they don't work in Expo Go at all.

1. Create a free account at <https://expo.dev>.
2. From `apps/mobile`:

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

   `init` links the app to an EAS project and writes its `projectId` into
   `app.json`. Commit that change.
3. Android push also needs Firebase Cloud Messaging credentials uploaded to EAS
   (Expo's "Push notifications setup" guide walks through it). iOS builds need
   an Apple Developer account.
4. Build a development app and install it on your phone:

   ```bash
   npx eas-cli@latest build:configure
   npx eas-cli@latest build --profile development --platform android
   ```

5. Start `npm run dev:mobile` and open the development build (not Expo Go). Sign
   in, allow notifications, then pay an invoice or send a proof of payment from
   its share link. The phone should get a notification.

---

## Quick check: what works where

| Feature | localhost | Public URL | Needs |
| --- | --- | --- | --- |
| Invoices, quotes, notes, PDFs, email | ✅ | ✅ | — |
| Proof of payment upload and review | ✅ | ✅ | R2 keys |
| PayFast / Yoco "Pay now" | ❌ | ✅ | Steps 2–3 |
| Rand subscriptions (Billing) | ❌ | ✅ | Step 4 |
| Push notifications | ❌ | ✅ | Step 5 |
