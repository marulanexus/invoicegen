# InvoiceGen monorepo

npm workspaces: `apps/web` (Next.js), `apps/mobile` (Expo), `packages/shared` (pure TS).
Each app has its own CLAUDE.md/AGENTS.md with framework rules — read the one for the app you touch.

- Install only from the repo root (`npm install`); there is one lockfile, at the root.
- Mobile dependencies: `npx expo install <pkg>` inside `apps/mobile`.
- One React version repo-wide (root `overrides`, matching the Expo SDK). Never add a second.
- `packages/shared` stays pure: no DB, no `server-only`, no React, no platform-specific APIs.
- Before declaring done: `npm run typecheck`, `npm test`, `npm run build:web`.
