# InvoiceGen

Invoices, quotes and receipts for small businesses — South Africa first, then
Africa and global. This is an npm-workspaces monorepo.

```
apps/
  web/        Next.js 16 web app + API (Neon/Drizzle, Clerk, Resend) — see apps/web/README.md
  mobile/     React Native (Expo SDK 57, Expo Router) owner app
packages/
  shared/     Pure TypeScript used by both apps (money, document math)
```

## Getting started

Requires Node 20+ and npm. Install **once, from the repo root** (never inside an app):

```bash
npm install
```

| Command | What it does |
| --- | --- |
| `npm run dev:web` | Start the web app on http://localhost:3000 |
| `npm run dev:mobile` | Start the Expo dev server (scan the QR code with Expo Go) |
| `npm run build:web` | Production build of the web app |
| `npm run typecheck` | Typecheck every workspace |
| `npm test` | Run every workspace's unit tests |
| `npm run lint` | Lint every workspace |

Run a script in one workspace with `-w`, e.g. `npm run db:push -w @invoicegen/web`.

## Running the mobile app on your phone

1. Install **Expo Go** on your phone (Play Store / App Store).
2. `cp apps/mobile/.env.example apps/mobile/.env.local` and set
   `EXPO_PUBLIC_API_URL` to your computer's LAN address (e.g. `http://192.168.1.20:3000`)
   and `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to the web app's publishable key.
3. Start both servers: `npm run dev:web` and, in a second terminal, `npm run dev:mobile`.
4. Scan the QR code with Expo Go (phone and computer on the same Wi-Fi). If the
   phone can't reach the API, allow Node.js through the Windows firewall on
   private networks.

The app talks only to `apps/web`'s `/api/v1` with the signed-in user's Clerk
session token; it never connects to the database directly.

## Adding dependencies

- Web or shared: `npm install <pkg> -w @invoicegen/web` (or `-w @invoicegen/shared`).
- Mobile: from `apps/mobile`, use `npx expo install <pkg>` so versions match the Expo SDK.
- Keep **one React version** across the repo. It is pinned by `overrides` in the
  root `package.json` to the version the Expo SDK requires; change it only when
  upgrading Expo, and update both apps together.

## Shared code rules

`packages/shared` must stay pure: no database, no `server-only`, no React, no
Node-only or browser-only APIs. It ships TypeScript source (no build step);
Next compiles it via `transpilePackages`, Metro compiles it for mobile.

## Test accounts

Online payments, InvoiceGen's own subscriptions and push notifications need
accounts of your own and a public HTTPS URL. See [docs/test-accounts.md](docs/test-accounts.md).

## Deployment

- **Web (Vercel):** set the project's *Root Directory* to `apps/web`. Vercel
  detects the npm workspace and installs from the root. `apps/web/vercel.json`
  holds the cron config.
- **Mobile:** EAS Build / Submit (`npx eas-cli@latest build`) — not set up yet.
