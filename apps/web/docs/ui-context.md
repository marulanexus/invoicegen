# UI Context — InvoiceGen

The design language, component inventory, and screen-by-screen UI reference.
Aesthetic: **professional / corporate** — calm, trustworthy, productive, like
FreshBooks but cleaner. Mobile-first.

---

## 1. Design principles

1. **Speed over chrome** — minimize clicks to create & send an invoice.
2. **Mobile-first** — every flow must be excellent at ~380px.
3. **Calm corporate palette** — blues, slate grays, generous whites.
4. **Live feedback** — the builder previews the exact document as you type.
5. **Helpful empty states & success toasts** — never a dead end.
6. **Accessible** — labels, focus rings, keyboard nav, color contrast.

---

## 2. Theme tokens (source: `src/app/globals.css`)

Defined in **oklch** for perceptual consistency; light + `.dark` variants.

| Token | Role |
| --- | --- |
| `--background` / `--foreground` | page base |
| `--card` / `--card-foreground` | surfaces |
| `--primary` | corporate blue (brand, CTAs, links) |
| `--secondary` / `--muted` | subtle fills, secondary text |
| `--accent` | hover/selected tints |
| `--destructive` | errors, overdue, delete |
| `--success` | paid, positive metrics |
| `--warning` | partial, expiring |
| `--border` / `--input` / `--ring` | strokes & focus |
| `--sidebar*` | sidebar surface set |
| `--chart-1..5` | chart series |
| `--radius` | 0.625rem base; `sm/md/lg/xl` derived |

- **Fonts:** Geist Sans (UI), Geist Mono (numbers/IDs) via `next/font`.
- **Dark mode:** `.dark` class on `<html>`, toggled by `ThemeProvider`, no-flash
  inline script in the root layout.
- **Usage rule:** components reference semantic tokens only; never hardcode hex
  (except user-chosen accent colors applied inline).

---

## 3. Component inventory

### Primitives — `src/components/ui/`
`button` (variants: default/destructive/outline/secondary/ghost/link/success;
sizes sm/default/lg/icon), `card` (+Header/Title/Description/Content/Footer),
`input`, `textarea`, `label`, `select`, `dialog`, `dropdown-menu`, `tabs`,
`switch`, `badge` (default/secondary/success/warning/destructive/outline),
`separator`, `skeleton`, `table` (+Header/Body/Row/Head/Cell), `sonner` (toaster).

### Form fields — `src/components/form/fields.tsx`
`TextField`, `TextAreaField`, `SelectField`, `SwitchField` — consistent
label + control + hint + error, `aria-invalid` wired.

### App chrome — `src/components/app/`
`app-shell` (sidebar + mobile drawer + topbar), `nav-items`, `page-header`,
`stat-card`, `empty-state`, `search-input` (debounced, URL-synced).

### Feature components
- `brand` (logo/wordmark), `marketing` (SiteHeader/Footer/PricingCards),
  `auth-shell`, `theme-provider`/`theme-toggle`.
- `documents/`: `document-builder`, `document-preview`, `documents-table`,
  `documents-list-screen`, `document-actions`, `document-detail-actions`.
- `clients/`: `client-form`, `client-actions`.
- `payments/`: `record-payment-dialog`.
- `settings/`: `settings-nav`, `business-profile-form`, `email-settings-form`,
  `billing-panel`.
- `dashboard/`: `revenue-chart`.
- `onboarding/`: `onboarding-wizard`.

---

## 4. Layout system

- **Marketing**: sticky translucent header, max-w-6xl content, footer.
- **Auth**: split screen — brand panel (primary bg) + form panel.
- **App shell** (`(app)` group):
  - Desktop: fixed `w-64` sidebar (`bg-sidebar`) with logo, nav, plan card;
    main column with sticky 64px topbar.
  - Mobile: hamburger opens a slide-over drawer; topbar shows org name, a
    compact "+" new-invoice button, theme toggle, Clerk user button.
- **Content width**: forms/settings `max-w-3xl/4xl`; builder & detail use a
  two-column grid that collapses to stacked on mobile.

---

## 5. Screen-by-screen

| Route | Purpose | UI highlights |
| --- | --- | --- |
| `/` | Marketing landing | hero + mock invoice, 8-feature grid, 4-step "how", pricing, CTA |
| `/pricing` | Plans | 3 cards (Growth featured), FAQ |
| `/sign-in`, `/sign-up` | Auth | Clerk components in split shell |
| `/onboarding` | First-run setup | 4-step stepper, live summary card |
| `/dashboard` | Home | 4 stat cards, revenue area chart, quick actions, recent invoices |
| `/clients` | CRM list | search, avatar initials, outstanding column, empty state |
| `/clients/[id]` | Client detail | profile card, stat cards, documents table |
| `/clients/new`, `/[id]/edit` | Client form | sectioned cards, tag chips |
| `/invoices`, `/quotes`, `/receipts` | Doc lists | status filter chips, search, table |
| `/documents/new`, `/[id]/edit` | **Builder** | left form / right sticky live preview; mobile Edit⇄Preview toggle |
| `/documents/[id]` | Doc detail | paper preview + summary sidebar + actions + payments |
| `/payments` | Payments | totals header, table, record-payment dialog |
| `/calendar` | Calendar | month grid; due dates (primary) & expiries (warning) |
| `/settings/*` | Settings | tabbed: Business, Email, Billing, Team |

---

## 6. The document preview (signature UI)

- `DocumentPreview` renders an A4-proportioned (`aspect-ratio 1/1.414`) white
  "paper" with: logo/brand glyph + From block, doc title/number/dates, Bill-To,
  line-item table (accent header), totals stack (accent grand total), notes &
  terms, optional "Powered by InvoiceGen" footer (hidden on Business plan).
- It is **driven by the same `DocumentView`** as the PDF, so the on-screen
  preview is pixel-faithful to what the client receives.
- In the builder it updates live (`useMemo` over form state); on the detail page
  it renders from stored rows via `viewFromStored`.

---

## 7. Interaction & feedback patterns

- **Loading**: `useTransition` `pending` → spinner in buttons (`Loader2`).
- **Success/error**: `sonner` toasts (top-right, rich colors).
- **Destructive**: `confirm()` guard before delete; destructive button variant.
- **Search**: debounced `SearchInput` writes `?q=` to the URL (shareable).
- **Filters**: status chips as links (`?status=`), active state highlighted.
- **Empty states**: `EmptyState` with icon, copy, and a primary action.

---

## 8. Responsive & accessibility checklist

- Test at 380px, 768px, 1280px.
- Sidebar → drawer below `lg`; builder columns stack below `lg`; line-item rows
  reflow into a 2×2 grid on small screens.
- Every input has a `<Label>`; icon-only buttons have `aria-label`.
- `aria-invalid` on errored fields; visible `:focus-visible` ring globally.
- Color is never the sole signal (status uses text labels in badges).
- Respects `prefers-color-scheme` on first visit, then user choice persists.

---

## 9. Extending the UI (quick guide)

1. Reuse a `ui/*` primitive; if missing, add one that wraps Radix + `cn`.
2. Build feature UI under `components/<domain>/`.
3. Forms: compose `form/fields.tsx`; submit to a server action; toast + refresh.
4. Use `PageHeader`, `StatCard`, `EmptyState` for consistency.
5. Verify dark mode and mobile before merging.
