# Code Standards — InvoiceGen

Conventions for writing code that reads like the rest of the codebase.

---

## 1. Language & tooling

- **TypeScript strict** everywhere. No `any` unless unavoidable (the only
  sanctioned use is the Drizzle `tx` param in `numbering.ts`, kept narrow).
- Target/module per `tsconfig.json` (ES2017 lib, bundler resolution).
- Path alias: import internal modules with `@/…` (maps to `src/`).
- Run `npx tsc --noEmit` and `npm run build` before completing work.
- ESLint via `eslint-config-next`; fix warnings, don't suppress broadly. Inline
  `// eslint-disable-next-line` is allowed only for intentional cases
  (e.g. `<img>` in PDF/preview where `next/image` doesn't apply).

---

## 2. File & naming conventions

| Kind | Convention | Example |
| --- | --- | --- |
| Files | `kebab-case.ts(x)` | `document-builder.tsx` |
| React components | `PascalCase` | `DocumentBuilder` |
| Functions / vars | `camelCase` | `reserveDocumentNumber` |
| Types / interfaces | `PascalCase`, no `I` prefix | `DocumentView` |
| Enums (DB) | `snake_case` pg enums | `document_status` |
| Server queries | `server/<domain>/queries.ts` | `listDocuments` |
| Server mutations | `server/<domain>/actions.ts` | `createDocument` |
| Constants | `UPPER_SNAKE` for module-level config | `PLAN_ORDER`, `NAV_ITEMS` |

---

## 3. Server vs client components

- **Default to server components.** Add `"use client"` only when you need state,
  effects, event handlers, or browser APIs.
- Server components fetch data (via `server/*` queries) and pass plain,
  serializable props to client components.
- Client components must **not** import `server/*` query/action modules at the
  top level except server **actions** (which are callable from the client by
  design).
- Mark read modules with `import "server-only";` and mutation modules with
  `"use server";`.

---

## 4. Server actions

Standard skeleton:

```ts
"use server";

export async function doThing(raw: unknown): Promise<ActionResult> {
  const ctx = await requireOrgContext();

  const parsed = thingSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form.",
             fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // ...plan checks, DB writes (transaction if atomic)...

  await logActivity({ orgId: ctx.org.id, actorMemberId: ctx.member.id,
                      action: "thing.created" });
  revalidatePath("/things");
  return { ok: true, id };
}
```

- Always return the `ActionResult` shape (`ok`, optional `id`, `error`,
  `fieldErrors`). **Never throw to the client.**
- Use `db.transaction(async (tx) => …)` for multi-row atomic writes (document +
  line items, payment + status update).

---

## 5. Data access (Drizzle)

- Import `db` from `@/server/db` (lazy proxy). Import tables/types from
  `@/server/db/schema`.
- **Always** include `eq(table.orgId, ctx.org.id)` in `where`.
- Prefer explicit `.select({ … })` projections for list queries; use grouped
  aggregates (`sql<…>` + `groupBy`) instead of N+1 loops.
- Upserts: `.onConflictDoUpdate({ target, set })` / `.onConflictDoNothing()`.
- Returning ids: `.returning()` then destructure `const [row] = …`.

---

## 6. Validation (Zod)

- All shared schemas live in `src/lib/validators.ts`
  (`businessProfileSchema`, `clientSchema`, `documentSchema`, `lineItemSchema`,
  `paymentSchema`). Domain-specific ones (e.g. email settings) may live next to
  their action.
- Coerce numerics with `z.coerce.number()`; normalize empty strings to
  `undefined` via the shared `optionalString` / `optionalEmail` helpers.
- Validate in the **action**, not the component (client checks are UX-only).

---

## 7. Money & numbers

- Storage: `numeric(14,2)` (money), `numeric(12,3)` (quantity), `numeric(5,2)`
  (rates). All surface as **strings**.
- Parse with `toNumber()`, round with `round2()`, format for storage with
  `toMoneyString()`, format for display with `formatCurrency(value, currency)`
  — all in `src/lib/money.ts`.
- Document math is **only** in `src/lib/calc.ts` (`calcLine`,
  `calcDocumentTotals`, `balanceDue`). Reuse it; never re-derive totals inline.

---

## 8. Dates

- Store `date` columns as `YYYY-MM-DD` strings; timestamps as `timestamptz`.
- Format/parse via `src/lib/format.ts` (`formatDate`, `formatRelative`,
  `toDate`). Use `date-fns` for arithmetic.

---

## 9. Styling

- Tailwind v4, CSS-first config in `globals.css`. **No `tailwind.config.js`.**
- Use semantic tokens (`bg-card`, `text-muted-foreground`, `border`,
  `bg-primary`, `bg-sidebar`, `text-destructive`, `bg-success/15`, …).
- Compose with `cn()` (clsx + tailwind-merge).
- Variants via `class-variance-authority` (see `button.tsx`, `badge.tsx`).
- Dark mode: `.dark` class + `@custom-variant`; do not write `dark:` utilities.
- Responsive: mobile-first; design for ~380px then scale up with `sm:`/`lg:`.
- Accent/brand colors chosen by users are applied via inline `style`, not classes.

---

## 10. UI component patterns

- Primitives in `components/ui/*` wrap Radix and accept `className` merged via
  `cn`. Keep them unopinionated and composable.
- Forms use the controlled field components in `components/form/fields.tsx`
  (`TextField`, `TextAreaField`, `SelectField`, `SwitchField`) — they render
  label, control, hint, and error consistently.
- Feedback: `toast` (sonner) for success/error; `useTransition` `pending` for
  loading; always provide an `EmptyState` for empty lists.
- Accessibility: label every control, set `aria-invalid` on errored inputs,
  give icon-only buttons `aria-label`, preserve visible focus rings.

---

## 11. Error handling

- Server actions: catch known errors (`PlanLimitError`) and map to `error`
  strings; let truly unexpected errors throw (surfaced by Next error boundary).
- `logActivity` is best-effort and never throws into callers.
- Route handlers return proper status codes (`401/404/400/500`) with JSON.

---

## 12. Imports & ordering

1. Node/React/Next
2. Third-party packages
3. `@/components/*`
4. `@/server/*`
5. `@/lib/*`
6. Types (`import type …`) grouped with their source or last.

Use `import type` for type-only imports (keeps server types out of client bundles).

---

## 13. Comments

- Explain **why**, not what. Document non-obvious invariants (transactional
  numbering, snapshotting, lazy DB proxy) at the definition site.
- Keep comment density consistent with surrounding files.

---

## 14. Commits (if/when git is initialized)

- Small, focused commits; imperative subject (`Add recurring invoice generator`).
- Don't commit `.env.local`, build output, or secrets.
- Co-author trailer for AI-authored commits per repo policy.
