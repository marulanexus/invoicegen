# AI Workflow Rules — InvoiceGen

> Operating rules for any AI agent (or developer) contributing to this codebase.
> Read this **before** editing. It encodes the conventions that keep the system
> coherent, secure, and multi-tenant-safe.

---

## 0. Golden rules (non-negotiable)

1. **Every data query and mutation is tenant-scoped.** Always filter by
   `orgId`. Never trust a client-supplied `orgId` — derive it from
   `requireOrgContext()` / `getOrgContext()`.
2. **Never read secrets from `process.env` directly in feature code.** Use
   `src/lib/env.ts` (typed, with `isXConfigured` flags).
3. **Money is `numeric(14,2)` (strings at the DB boundary).** Do arithmetic only
   through `calc` + `money` in `packages/shared` (re-exported as `@/lib/calc` and
   `@/lib/money`). Never use raw `+`/`*` on money
   pulled from the DB.
4. **Validate all external input with Zod** (`src/lib/validators.ts`) inside the
   server action, before touching the DB.
5. **The preview and the PDF must always match.** Both render from one
   `DocumentView` (`src/lib/document-view.ts`). If you change one renderer,
   update the shared view, not just the renderer.
6. **Keep `next build` green and `tsc --noEmit` clean** before declaring done.

---

## 1. Where things live

| You want to… | Put it in… |
| --- | --- |
| Add a DB table/column | `src/server/db/schema.ts` → run `npm run db:generate` |
| Read data for a page | `src/server/<domain>/queries.ts` (marked `import "server-only"`) |
| Mutate data | `src/server/<domain>/actions.ts` (`"use server"`) |
| Reusable pure logic | `src/lib/*` (no DB, no `server-only`) |
| A UI primitive (button, dialog…) | `src/components/ui/*` |
| Feature UI | `src/components/<domain>/*` |
| A route/page | `src/app/(app)/<route>/page.tsx` |
| An API endpoint | `src/app/api/<path>/route.ts` |

**Domains:** `clients`, `documents`, `payments`, `billing`, `settings`,
`onboarding`, `email`, `dashboard`, `pdf`, `auth`.

---

## 2. The server action pattern (follow exactly)

Every mutation is a server action that:

1. Starts with `"use server"`.
2. Calls `const ctx = await requireOrgContext()` first.
3. Parses input with a Zod schema via `safeParse`.
4. Enforces plan limits where relevant (`assertCanCreate*`).
5. Performs the write (in a transaction if multi-row/atomic).
6. Logs an activity entry (`logActivity`).
7. Calls `revalidatePath(...)` for affected routes.
8. Returns a typed result object — **never throws to the client**.

**Canonical result shape:**

```ts
export interface ActionResult {
  ok: boolean;
  id?: string;
  error?: string;                      // user-facing, shown via toast
  fieldErrors?: Record<string, string[]>; // from zod flatten().fieldErrors
}
```

**Client side:** call inside `useTransition`, branch on `res.ok`, show
`toast.error(res.error)` or `toast.success(...)`, then `router.refresh()` or
`router.push(...)`.

> ⚠️ Never `return toast.error(...)` inside a `startTransition` callback — the
> transition function must return `void | Promise<void>`. Use a statement +
> `return;` instead. (This is a real bug we hit; see `document-actions.tsx`.)

---

## 3. Multi-tenancy & auth

- Tenancy is resolved by `getOrgContext()` in `src/server/auth/context.ts`,
  memoized per request with React `cache()`.
- Tenant key = the active Clerk **org id**, or a synthetic `user:<id>` for solo
  users. The org, member, and a free `subscriptions` row are **auto-provisioned**
  on first authenticated request.
- Route protection is in `src/middleware.ts` (Clerk). Public routes are listed in
  `isPublicRoute`. When Clerk keys are absent, middleware is a passthrough and the
  `(app)` layout redirects to `/sign-in`.
- **Onboarding gate:** the `(app)` layout redirects to `/onboarding` until
  `businessProfiles.onboardingCompleted` is true.

---

## 4. Plan limits & billing

- Plan definitions: `src/lib/plans.ts` (`free` / `growth` / `business`).
- Enforcement helpers: `src/server/billing/usage.ts`
  (`assertCanCreateClient`, `assertCanCreateDocument`, `incrementUsage`).
- Catch `PlanLimitError` in actions and return it as `{ ok:false, error }`.
- Stripe lives in `src/server/billing/{stripe,actions}.ts` and the webhook at
  `src/app/api/webhooks/stripe/route.ts`. The webhook is the **only** writer of
  `organizations.plan` from billing events.

---

## 5. Documents (the core domain)

- Creation/update is transactional (`src/server/documents/actions.ts`).
- Numbers are reserved atomically via `reserveDocumentNumber(tx, orgId, type)`
  **inside the same transaction** as the insert — never outside.
- Totals are computed with `calcDocumentTotals()` at save time and stored;
  do not recompute differently elsewhere.
- On create we snapshot `fromSnapshot` (business) and `billToSnapshot` (client)
  so historical documents never change when the profile/client changes later.
- Status transitions go through `changeDocumentStatus()` /
  `recordPayment()` — do not flip `status` ad hoc.

---

## 6. Styling rules (Tailwind v4)

- Theme is CSS-first in `src/app/globals.css` (`@theme`, `@custom-variant dark`).
  **There is no `tailwind.config.js`.**
- Use **semantic tokens only**: `bg-background`, `text-foreground`,
  `bg-primary`, `text-muted-foreground`, `border`, `bg-card`, `bg-sidebar`, etc.
  Never hardcode hex in components (except user-chosen accent colors passed as
  inline `style`).
- Dark mode is a `.dark` class on `<html>`; never use `dark:` media — the custom
  variant handles it.
- Compose classes with `cn()` from `src/lib/utils.ts`.

---

## 7. Definition of done

Before you say a task is complete:

- [ ] `npx tsc --noEmit` is clean
- [ ] `npm run build` succeeds
- [ ] New queries/mutations are `orgId`-scoped
- [ ] Input is Zod-validated; action returns the standard result shape
- [ ] Plan limits enforced if the action creates billable resources
- [ ] `revalidatePath` called for affected routes
- [ ] UI has loading (`useTransition`), error (toast), and empty states
- [ ] Works on mobile (test ~380px) and in dark mode
- [ ] `progress-tracker.md` updated if scope changed

---

## 8. Things NOT to do

- ❌ Don't import `@/server/*` query/action files into client components
  (they're server-only). Pass data down as props instead.
- ❌ Don't call `process.env` outside `src/lib/env.ts`.
- ❌ Don't create the DB pool eagerly — `db` is a lazy proxy on purpose
  (keeps `next build` working without `DATABASE_URL`).
- ❌ Don't add a `tailwind.config.js` (v4 is CSS-first).
- ❌ Don't bypass `reserveDocumentNumber` for numbering.
- ❌ Don't store plaintext SMTP passwords — encrypt with `src/lib/crypto.ts`.
- ❌ Don't rename `middleware.ts` to `proxy.ts` casually — Clerk's integration
  uses `middleware.ts`; the Next 16 deprecation warning is cosmetic.
