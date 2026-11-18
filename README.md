# Quonnect Vendor

Mobile-first business app for market vendors: record sales with a price override, track stock, expenses, income and budgets, see hand-built analytics, and publish an online stall.

The UI is a 1:1 rebuild of `quonnect-vendor-app.html`, rendered inside a centred 420px phone shell on desktop. Backend is Supabase (Postgres + Auth + Storage) with Next.js App Router server components and server actions.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase keys
npm run dev                  # http://localhost:3000
npm run dev:lan              # prints the tablet URL, then serves on 0.0.0.0
```

Required env:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# only for scripts/seed-demo.ts, never for the app
SUPABASE_SERVICE_ROLE_KEY=
```

If login or signup shows **"Cannot reach Supabase"**, run:

```bash
npm run check:supabase
```

The current `.env.local` points at `akfktjvckvlfclkwjppn.supabase.co`, which does not resolve.
Restore/create the project, copy its URL plus anon key into `.env.local`, restart `npm run dev`,
then apply the migrations and regenerate types.

## Supabase setup

The project must have the migrations in `supabase/migrations/` applied:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase gen types typescript --linked > src/types/database.types.ts
```

Migration order:

1. `20260901_00_baseline.sql` — creates `vendors`, `products`, `finance_entries` and their base RLS (these were previously created out of band).
2. `20260928_01_core_and_modular_schema.sql` — existing modular schema.
3. `20260928_02_report_stock_rpc.sql` — existing stock report RPC.
4. `20261021_01_ui_rebuild.sql` — stalls, stock movements, budgets, profile/product/sale columns, storage policies, transactional RPCs and dashboard aggregates.
5. `20261023_01_product_categories.sql` — per-vendor custom product categories.
6. `20261023_02_vendor_month_start.sql` — configurable business-month start day.
7. `20261029_01_product_photo_gallery.sql` — ordered `photo_urls` gallery (up to 8) with the first photo mirrored to `photo_url`.
8. `20261102_01_dashboard_accounts.sql` — business accounts, append-only account movements and the period-based dashboard RPC.

`src/types/database.types.ts` mirrors the final schema; `src/types/app-db.ts` re-exports `AppDatabase` and row aliases. Regenerate after any migration instead of hand-editing the generated file.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run dev:lan` | Print the current tablet URL, then serve on `0.0.0.0` for Wi-Fi testing |
| `npm run check:supabase` | Check DNS and HTTP reachability of the configured Supabase project |
| `npm run db:apply` | Apply the validated schema bundle using `SUPABASE_DB_URL` (one transaction) |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run seed:demo -- --email you@example.com` | Dev-only demo history (requires service-role key). Add `--reset` to replace demo rows. |
| `npm run test:unit` | Pure-logic tests (formatting, axes, discounts, receipt text) |
| `npm run test:acceptance` | Database acceptance tests (sales, net profit, month switch, RLS). Requires a reachable project + service-role key. |
| `node scripts/ui-screenshots.mjs` | Visual QA screenshots at 430px into `docs/ui-checks/` (dev server running) |
| `node scripts/ui-interactions.mjs` | Sheet/cart screenshots |

## Routes

| Route | Purpose |
| --- | --- |
| `/login`, `/signup` | Email/password auth and 3-step vendor signup |
| `/home` | Reporting-period dashboard: available funds, sales, expenses, profit, customer balances, stock value, charts, insights and quick actions |
| `/business` | Business hub: income & expenses, analytics and customers in one place |
| `/sell` | Product chips, editable sold price, transactional sale, receipts |
| `/stock` | Stock value, categories, product registration, restock |
| `/money` | Standalone expenses, other income and budgets (also embedded in `/business`) |
| `/analytics` | Standalone growth, monthly sales, expense trend, cost vs price (also embedded in `/business`) |
| `/orders` | Sales, bookings and messages |
| `/customers` | Customer directory and spend history (also embedded in `/business`) |
| `/stall` | Listings, publish toggles, deals, stall customisation, customer preview (owner session) |
| `/menu` | Account, business tools, support and logout |
| `/settings` | Profit-month setting and account links |
| `/notifications`, `/help` | Tips and support |
| `/profile` | Vendor/business/social details, logo, password, logout |

The bottom bar is **Home · Business · My Stall · Orders · Menu**. Legacy money, analytics and customer routes still work and highlight the Business tab; settings, notifications, help and profile highlight Menu.

Auth is enforced by `src/proxy.ts` (Next 16's replacement for middleware). Signed-in users are redirected from `/` and auth pages to `/home`.

## Architecture

```
src/app/(app)/          authenticated screens + shared shell
src/app/login,signup    auth screens
src/actions/            server actions (auth, sales/products, money, stall/profile)
src/components/app/     Header, TabBar
src/components/screens/ screen-level client components
src/components/ui/      Icon, BottomSheet, Toast, Avatar, Thumb
src/components/charts/  LineChart, BarChart, ProfitBars (hand-built SVG)
src/lib/supabase/       browser/server/proxy Supabase clients
src/lib/data.ts         server-side reads and RPC calls
src/lib/receipt.ts      canvas receipt + WhatsApp text/share utilities
src/lib/constants.ts    categories, sizes, palette, analytics groups
```

Server components load data; client components only handle interaction. Writes go through server actions, then `revalidatePath`, so numbers update immediately. No chart or UI library is used; charts are ports of the prototype's SVG algorithms.

## Feature flags

Feature visibility is centralised in `src/lib/features.ts`. Core features (`home`, `sales`, `stock`,
`money`) are always on. Stage 1 optional features (`customers`, `suppliers`, `budgets`, `accounts`,
`analytics`, `insights`) are on for existing vendors and off for new signups until enabled. The
Business hub, Home quick actions and Menu use `hasFeature()` so hidden features do not leave dead
links. Stage 2/3 keys (`staff`, `purchasing`, `branches`, etc.) are reserved for later modules.

See [`docs/BUSINESS_MODULES_AND_NAVIGATION.md`](docs/BUSINESS_MODULES_AND_NAVIGATION.md) for the
route map, Business hub, feature-gating rules and current UX principles.

## Business rules

See [`docs/FINANCE_AND_STOCK_LOGIC.md`](docs/FINANCE_AND_STOCK_LOGIC.md) for the full finance, stock and profit model, including worked examples and known edge cases.

- Effective price = `price × (1 − discount_pct / 100)`.
- A product holds up to 8 photos in `photo_urls`; the first is the cover and is mirrored to `photo_url` for legacy thumbnails and reports.
- Each sale item stores `listed_price`, `sold_price` and `unit_cost` at sale time.
- Sale profit = `Σ((sold − unit_cost) × qty)`; price reduction = `Σ((listed − sold) × qty)`.
- `create_sale` is atomic: it locks products, validates stock, decrements, writes `stock_movements`, then writes the sale and items. Stock can never go negative.
- Restock is atomic and writes a `stock_movements` row; it can optionally create a `Stock purchase` ledger entry.
- Net profit = gross profit + other income − expenses **excluding** `Stock purchase`.
- Home budget used = this month's spend in budgeted categories ÷ the sum of those budgets.
- Trends hide the percentage when the comparison value is zero.
- Money is integer UGX and formatted `UGX 1,234,500`.

## Data model note

The rebuild reuses `finance_entries` as the single ledger instead of introducing duplicate `expenses` / `other_income` tables. Expense rows are `type = 'expense'`; other income rows are `type = 'income'`. See `docs/DATABASE_BRIEFING.md`.

## Dev-only files

- `src/app/preview/[screen]` — visual QA harness using fixture data. It returns 404 in production unless `ALLOW_PREVIEW=1`.
- `scripts/seed-demo.ts` — demo generator. It is never imported by the app and must only be run against a dev project.
- `scripts/ui-*.mjs` — Playwright screenshot helpers.

## Database status

The live project `akfktjvckvlfclkwjppn` has the full schema applied:
tables, columns, RLS, storage policies, transactional RPCs and dashboard
aggregates. `npm run test:acceptance` passes 19/19 against it.

Email confirmation is enabled in Supabase Auth, so new signups must confirm
their email before logging in. Existing vendors without a profile are repaired
by `/setup` on first visit.
