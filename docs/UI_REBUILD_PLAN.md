# Quonnect Vendor App — UI Rebuild Plan

**Branch:** `feat/ui-rebuild` (created from `main` @ `cdaa7ea`)
**Source of truth:** `quonnect-vendor-app.html` (read in full, 1,124 lines)
**Status:** Step 0 audit complete. **No application files have been deleted or modified.**

> **Important:** `main` already had 18 uncommitted modified files before this branch was created.
> They are preserved on `feat/ui-rebuild` and are treated as user work. They will be superseded
> by the rebuild, but not discarded without the go-ahead.

---

## 0. Audit findings you should know before approving

1. **The live Supabase project is not reachable from this machine.**
   `.env.local` points at `https://akfktjvckvlfclkwjppn.supabase.co`, which returns `NXDOMAIN`
   (the project may be paused, deleted, or the ref is stale). `scripts/test-connection.mjs` fails
   at DNS, so I could not introspect the live schema, RLS, storage policies or auth settings.
   The audit below is based on the repo's migrations, generated types and module docs.
   **I need either a reachable project/ref or confirmation that I should develop against a local
   Supabase stack (`supabase start`) and treat the checked-in migrations as the schema.**
2. **The checked-in migrations are not a complete schema.** The base tables `vendors`, `products`
   and `finance_entries` were created out-of-band (via MCP, per `DEVELOPMENT_LOG.md`), and the
   migrations only `ALTER` them. A fresh `supabase db reset` would fail. Phase 3 will add a
   baseline migration so the schema is reproducible.
3. **Existing auth is email + password only**, with no SSR cookie handling and no route protection.
   The current client is a singleton browser client (`src/lib/supabaseClient.ts`), and
   `AuthContext` silently falls back to a local "demo mode" whenever there is no session.
4. **There is no design-token setup to preserve.** `globals.css` is four global rules; the app is
   styled ad hoc with Tailwind utility classes and `lucide-react` icons. Both are being replaced.
5. **Next.js is 16.3.5.** Per `AGENTS.md`, I checked the bundled docs: `middleware.ts` is
   deprecated in Next 16 and renamed to `proxy.ts`. Auth route protection will use
   `src/proxy.ts`, which is the current convention, not the legacy filename.
6. **No Playwright is installed.** The quality bar requires 430px screenshot comparisons, so I
   will add `@playwright/test` as a dev dependency (not a UI library) and store checks in
   `docs/ui-checks/`.

---

## 1. What exists today

### Routes (`src/app`)

| Route | Current state |
| --- | --- |
| `/` | Dashboard: teal/glass KPI hero, finance entries, quick-add sheets, product modal |
| `/login` | Email/password login + inline signup, demo-mode escape hatch |
| `/onboarding` | 4-step category/currency/profile/first-sale flow with sample seeding |
| `/analytics` | Feature-gated analytics, lazy `AnalyticsDashboard` |
| `/pos` | 698-line POS: search, cart, discounts, credit, offline queue, receipt modal |
| `/sales` | Sales history and receipt access |
| `/expenses` | Expense/income ledger CRUD |
| `/reports`, `/reports/stock` | Report shell, period picker, stock RPC report |
| `/stall`, `/stall/[id]` | Product catalog management and public-style product detail |
| `/bookings` | Customer bookings/pre-orders (not in the HTML) |
| `/customers` | Customer directory/debts (not in the HTML) |
| `/damaged-items` | Stock-loss log (not in the HTML) |
| `/representatives` | Staff/representatives (not in the HTML) |
| `/suppliers` | Supplier directory (not in the HTML) |
| `/settings`, `/settings/more-tools` | Settings and feature-flag console (not in the HTML) |
| `/loading.tsx` | Global spinner |

### Components (~4,950 lines)

- `layout/`: `BottomNav` (4 tabs: Home, POS Sell, Reports, Products), `Navbar`, `FeatureGate`,
  `OfflineSyncIndicator`.
- `finance/`: `SummaryCards`, `GrowthChart` (hand-built SVG), `TransactionsList`,
  `AddTransactionModal`.
- `home/`: `QuickActionGrid`, `QuickAddSheet`, `GettingStartedChecklist`,
  `ContextualSuggestionCard`.
- `stall/`: `ProductCard`, `AddEditProductModal`, `ColorPicker`.
- `sales/`: `ReceiptModal` (print-style, not canvas).
- `analytics/`: `AnalyticsDashboard`.
- `reports/`: 11 report-specific components.
- `bookings/`: `BookingCard`, `NewBookingModal`.

### Data / platform layer

- `src/lib/supabaseClient.ts` — singleton browser client from `@supabase/supabase-js`, typed with
  the hand-maintained `Database` interface.
- `src/context/AuthContext.tsx` — session listener, profile fetch, **demo mode** fallback.
- `src/types/database.types.ts` — 992 lines, hand-maintained (not generated), 20 tables + one RPC.
- `src/lib/storage.ts` — resilient image upload to public `vendor-assets` bucket.
- `src/lib/seedSampleData.ts` + `sampleData.ts` — sample products/customers/sales written to the
  database or localStorage. **Must not ship.**
- `src/lib/features.ts` — feature-flag hooks backed by `vendors.features_enabled`.
- `src/lib/offlineQueue.ts` — localStorage sale queue used only by the old POS.
- `src/lib/formatters.ts` — `formatUGX`, dates. Keep.
- `src/lib/reportDateUtils.ts`, `productColors.ts`, `serverFeatures.ts` — old UI helpers.
- No TanStack Query, no server actions, no route handlers, no proxy/middleware.

### Database (from migrations + docs + types)

Tables: `vendors`, `products`, `finance_entries`, `customers`, `sales`, `sale_items`,
`payments`, `shop_suggestions`, `bookings`, `damaged_items`, `suppliers`, `purchases`,
`purchase_items`, `purchase_orders`, `quotations`, `activity_log`, `shop_members`, `stores`,
`stock_levels`, `stock_transfers`, `product_images`, `report_stock` RPC.

- RLS is enabled on all owned tables; policies use the
  `EXISTS (SELECT 1 FROM vendors v WHERE v.id = <table>.vendor_id AND v.user_id = auth.uid())`
  pattern. Policies are `FOR ALL USING (...)` and do not explicitly declare `WITH CHECK`.
- `products` has a public-read policy for `is_active = true` (marketplace).
- One public storage bucket `vendor-assets`; path convention
  `vendor-assets/{vendor_id}/products/{product_id}.{ext}`; public read, authenticated write.
- A trigger `on_auth_user_created_vendor` (created out-of-band) inserts a `vendors` row at signup;
  the app also upserts defensively.
- There is **no** `stalls`, `stock_movements` or `budgets` table.

---

## 2. What I will keep

### Platform and data layer — keep and extend

- **Supabase project, auth provider, storage bucket** and existing RLS ownership pattern.
- **Existing tables that fit**: `vendors`, `products`, `sales`, `sale_items`, `payments`,
  `customers`, `finance_entries`, and the `vendor-assets` bucket.
- **Email/password auth**, because it already works and the signup form collects a password.
  Phone is collected and stored; phone OTP is added only if the project has an SMS provider.
- `formatUGX` / date formatting helpers (rewritten to match the HTML exactly, including
  `UGX 1,234,500`).
- Image upload intent from `src/lib/storage.ts` (rewritten as a typed client helper that resizes
  before upload and stores only the URL).
- The public-read marketplace policy on published products, which the "customer preview" needs.

### Behaviour worth carrying over

- Sale writes in a transaction with stock decrement (the old POS does this partially — the new
  RPC will make it atomic).
- Product photo upload retry/backoff idea.
- `report_stock` RPC is not needed by the new UI, but the table/function can remain.

---

## 3. What will be deleted or replaced

### Deleted

- All routes not in the new spec: `/bookings`, `/customers`, `/damaged-items`, `/expenses`,
  `/onboarding`, `/pos`, `/reports*`, `/representatives`, `/sales`, `/settings*`,
  `/stall/[id]`, plus the old `/analytics`, `/stall` implementations.
- All components under `src/components/` except what is explicitly ported into the new
  `components/ui`, `components/charts`, `components/screens` structure (i.e. the entire old
  component tree is replaced).
- `src/components/layout/OfflineSyncIndicator.tsx`, `FeatureGate.tsx`,
  `src/lib/features.ts`, `src/lib/serverFeatures.ts`, `src/lib/offlineQueue.ts`,
  `src/lib/sampleData.ts`, `src/lib/seedSampleData.ts`, `src/lib/productColors.ts`,
  `src/lib/reportDateUtils.ts`.
- `lucide-react` from the dependency list once no imports remain.
- Demo mode, localStorage account/product/sale state, fake password hashing, demo seeding.
- Old prototype screenshots and module-status docs that describe the replaced UI
  (rewritten at Phase 12, not silently deleted before that).

### Replaced

- `src/app/layout.tsx` → centred 420px phone shell + tokens + Toast provider.
- `src/app/page.tsx` → redirect to `/home` (or `/login`).
- `src/app/globals.css` → Tailwind v4 import + CSS-variable token contract ported from the HTML.
- `AuthContext` → server-aware auth helpers + small client session context; no demo fallback.
- `supabaseClient.ts` → browser client + server client (`@supabase/ssr`) so server components can
  read the session cookie.
- `database.types.ts` → regenerated from the migrated schema (see blocker in §0).
- `ReceiptModal` → new canvas-based receipt builder (client utility `buildReceipt`).

### Database objects left in place but unused

`bookings`, `customers`, `damaged_items`, `suppliers`, `purchases`, `purchase_items`,
`purchase_orders`, `quotations`, `activity_log`, `shop_members`, `stores`, `stock_levels`,
`stock_transfers`, `product_images`, `shop_suggestions`, `report_stock`. Dropping them is
destructive and out of scope; the HTML has no UI for them. They remain isolated by RLS.

---

## 4. Schema gaps versus the requested data model

### Mapping existing columns (avoid duplication)

| Requested field | Existing column | Decision |
| --- | --- | --- |
| `vendors.vendor_name` | `vendors.owner_name` | Keep `owner_name`; UI label "Vendor name". |
| `vendors.location` | `vendors.region` / `address` | Keep `region` as location; `address` remains available. |
| `products.quantity` | `products.stock` | Keep `stock`; API/types expose it as quantity. |
| `products.image_url` | `products.photo_url` | Keep `photo_url`. |
| `products.is_published` | `products.is_active` | Keep `is_active`; rename only in the app layer. |
| `sales.created_at` | `sales.created_at` + `sale_date` | Keep both; daily grouping uses `sale_date` (Kampala date). |
| `sale_items.name` | `sale_items.product_name` | Keep `product_name`. |
| `expenses` / `other_income` | `finance_entries` with `type` | **Reuse** the ledger: `expense` rows are expenses, `income` rows are other income. No duplicate tables. |
| `expenses.note` | `finance_entries.notes` | Keep `notes`. |
| `expenses.created_at` | `finance_entries.entry_date` + `created_at` | `entry_date` is the business date. |

### Missing columns

- `sales`: `price_reduction numeric(14,2) NOT NULL DEFAULT 0`, `customer_phone text`,
  `customer_email` is not required by the HTML (skip).
- `sale_items`: `listed_price numeric(14,2)`, `sold_price numeric(14,2)`.
  (`unit_price` is backfilled from `sold_price`; `unit_cost` already exists.)
- `products`: `sizes text[] NOT NULL DEFAULT '{}'`, `colors text[] NOT NULL DEFAULT '{}'`,
  `discount_pct integer NOT NULL DEFAULT 0 CHECK (0..90)`. (`cost`, `price`, `category`,
  `description`, `stock`, `photo_url`, `is_active` exist.)
- `vendors`: `phone2 text`, `motto text`, `instagram text`, `facebook text`, `tiktok text`,
  `whatsapp text`. (`logo_url`, `email`, `owner_name`, `region`, `category` exist.)

### Missing tables

- `stalls`: `id`, `vendor_id` (unique, one stall per vendor), `name`, `tagline`,
  `accent_color` default `#0F8A4D`, timestamps. Auto-created by trigger for each vendor.
- `stock_movements`: `id`, `vendor_id`, `product_id`, `delta integer` (negative for sales),
  `reason` check in (`sale`,`restock`,`adjustment`), `created_at`. Every stock change writes a row.
- `budgets`: `id`, `vendor_id`, `category`, `monthly_limit numeric(14,2)`, `created_at`,
  unique `(vendor_id, category)`.

### Functions / views for aggregates

- `create_sale(p_vendor_id, p_items jsonb, p_payment_method, p_customer_name, p_customer_phone)`:
  one transaction — lock products, validate stock, decrement, insert sale + items, compute
  `total`, `profit`, `price_reduction`, write `stock_movements(reason='sale')`, return sale id.
- `restock_product(p_product_id, p_qty, p_new_cost, p_create_expense)`:
  one transaction — increment stock, optionally update cost, write `stock_movements`,
  optionally insert `finance_entries(type='expense', category='Stock purchase')`.
- `vendor_daily_metrics(p_vendor_id, p_from, p_to)` → per-day `sales`, `gross_profit`,
  `price_reduction`, `expenses`, `operating_expenses`, `other_income`, `net_profit`,
  `expected_revenue`.
- `vendor_monthly_metrics(p_vendor_id, p_months)` → the same rolled up by month.
- `vendor_dashboard(p_vendor_id)` → today/yesterday/month/recent transactions/low stock/budget
  aggregates in one round trip (or a small set of narrow RPCs; decision at Phase 3).
- `vendor_category_stats`, `vendor_item_stats` for Analytics.
- All RPCs are `SECURITY INVOKER` where possible; if `SECURITY DEFINER`, they re-check
  `vendor_id` ownership against `auth.uid()`.

### RLS / security work

- Add explicit `WITH CHECK` to new and rebuilt policies; keep the vendor-ownership predicate.
- Enable RLS on `stalls`, `stock_movements`, `budgets`.
- Storage policies: authenticated users may write only under their own `{vendor_id}/` prefix;
  public read for product/logo assets.
- Never allow client-derived `vendor_id` to bypass ownership; actions resolve `vendor_id` from
  the authenticated user, not from form input.
- Add `updated_at` triggers where missing.

### Type generation

Regenerate `src/types/database.types.ts` with
`npx supabase gen types typescript --linked > src/types/database.types.ts` after migrations.
Blocked until the project is reachable. If it stays unreachable, I will generate from the local
schema after `supabase start` and note the provenance in the file header.

---

## 5. New application structure

```
src/
  app/
    layout.tsx                 # tokens, ToastProvider, phone shell
    globals.css                # token contract + base styles
    page.tsx                   # redirect -> /home or /login
    login/page.tsx
    signup/page.tsx            # 3 steps, client form + server action
    (app)/
      layout.tsx               # auth guard + Header + BottomTabBar
      home/page.tsx
      sell/page.tsx
      stock/page.tsx
      money/page.tsx
      analytics/page.tsx
      stall/page.tsx
      profile/page.tsx
    api/...                    # only if a route handler is needed (e.g. receipt upload)
  actions/                     # server actions grouped by domain
  components/
    ui/                        # Icon, BottomSheet, Toast, Chip, Segmented, Avatar, EmptyState, Field
    charts/                    # ProfitBars, LineChart, BarChart (ported SVG)
    screens/home/... etc
  lib/
    supabase/browser.ts, server.ts, proxy.ts
    format.ts, dates.ts, constants.ts, receipt.ts (client canvas), validation.ts
    queries/                   # typed RPC/view readers used by server components
  proxy.ts                     # Next 16 auth redirect (replaces middleware.ts)
scripts/seed-demo.ts           # dev-only; never imported by app code
docs/
  UI_REBUILD_PLAN.md
  DATABASE_BRIEFING.md
  ui-checks/*.png
```

- **Server components** load data via typed Supabase server client + RPCs/views.
- **Client components** only for interaction (sheets, cart, chart hovers, receipt canvas).
- **Writes** use server actions with `revalidatePath` for the affected routes, so numbers update
  immediately after a write. No TanStack Query needed; the repo has no query library and the
  spec permits server actions.
- Money is stored as integer UGX in new writes (`numeric` columns still accept whole numbers);
  all display goes through one `formatUGX` that renders `UGX 1,234,500`.

### Design system

- Tokens in `globals.css`: `--accent` (default `#0F8A4D`), `--mint`, `--page`, `--header-gradient`,
  `--positive`, `--negative`, `--warning`, `--ink`, `--muted`, radii, shadow.
- `accent_color` is loaded per vendor from `stalls` and injected as an inline CSS variable on the
  app shell; all derived tokens use `color-mix` exactly as the HTML.
- Body background `#D3E8DC`; shell max-width 420px, `border-radius: 28px` on desktop, height 92vh,
  shadow; mobile full-bleed.
- Header: 110deg accent gradient, diagonal shine pseudo-element, greeting, Synced pill, avatar
  with 3px white ring → `/profile`.
- Bottom tabs, exact order/icons/labels: Home, Sell, Stock, Money, Analytics, Stall.
- Icon component typed from the `ICONS` object; no emoji, no lucide.

---

## 6. Assumptions (things I will decide unless you say otherwise)

1. **Auth:** keep Supabase email + password (the spec allows "phone OTP and/or email"). The signup
   collects phone, but phone OTP is only enabled if your project has an SMS provider. Password
   reset via Supabase email reset; the prototype's "SMS reset" link becomes an email reset.
2. **Ledger:** use `finance_entries` for both expenses and other income instead of creating
   duplicate `expenses` / `other_income` tables. All business rules and views use
   `type='expense'` / `type='income'` and exclude `category='Stock purchase'` from net profit.
3. **Stall ownership:** exactly one stall per vendor. A trigger creates it at vendor creation and
   backfills existing vendors.
4. **Product aliases:** keep existing column names (`stock`, `photo_url`, `is_active`,
   `product_name`) and map them in the app/types rather than renaming columns. This preserves
   existing data and the public marketplace policy.
5. **Dashboard dates:** use `Africa/Kampala` as the business timezone for "today", month and trend
   comparisons, so a sale at 00:30 local time counts on the right day. The HTML used browser-local
   time, which happens to be EAT for the target users.
6. **Sample data:** the "Start with sample stock" checkbox in signup is removed from the live flow.
   `scripts/seed-demo.ts` will create demo data explicitly against a dev project using the service
   role key from an env var (never committed).
7. **No new UI library.** `@supabase/ssr` and `@playwright/test` are the only additions; both are
   infrastructure/test dependencies. Charts remain hand-built SVG.
8. **Deletes:** product deletion is not in the HTML, so the UI offers publish/hide and edit, not
   delete. Old tables for removed features are left untouched.
9. **Receipts:** receipt PNGs are generated locally and shared/downloaded; they are not uploaded
   unless you want a receipt archive (not in the HTML).
10. **Customer preview:** the "What customers see" grid is a local preview of published products,
    not a separate public marketplace route. A public stall page is out of scope.
11. **Sync pill:** shows "Synced" as static status; there is no offline sync queue in the HTML, so
    the old offline queue is removed.

---

## 7. Phase plan (commit after each phase, push to `feat/ui-rebuild`)

| Phase | Scope | Key deliverable | Commit |
| --- | --- | --- | --- |
| 1 | Tokens, shell, header, 6-tab bar, `Icon`, `BottomSheet` (focus trap, Escape), `Toast`, base UI | Static `/home` shell matching HTML at 430px | `feat(ui): design tokens and app shell` |
| 2 | Supabase SSR clients, `proxy.ts`, `/login`, 3-step `/signup`, profile creation, logout, auth guards | Real signup/login round trip | `feat(auth): supabase auth and 3-step signup` |
| 3 | Baseline migration, columns, `stalls`, `stock_movements`, `budgets`, RLS, RPCs/views, regenerate types, dev seed | Reproducible schema + typed client | `feat(db): schema, rls and aggregate rpcs` |
| 4 | Stock screen: snap card, categories, product sheet, sizes, photo upload, restock, movements | Add/restock products with correct stock ledger | `feat(stock): products, photos and restocking` |
| 5 | Sell screen: chips, cart, editable sold price, warnings, atomic sale RPC, recent sales, sale-done sheet | Price override + stock decrement + margin | `feat(sell): cart and transactional sales` |
| 6 | Receipt canvas, share/download, WhatsApp text | Pixel-matched receipt PNG | `feat(receipts): canvas receipts and sharing` |
| 7 | Money: Expenses / Income / Budgets tabs and sheets, progress bars | Full ledger CRUD + budgets | `feat(money): expenses, income and budgets` |
| 8 | Home: 3 stat cards, month dropdown, budget banner, profit trend (7D/30D/Custom, max 60), daily profit, recent + all transactions, low stock | Dashboard fed by aggregate RPCs | `feat(home): dashboard and profit trend` |
| 9 | Analytics: growth, monthly sales, expense trend + breakdown, cost vs price, all controls | Hand-built SVG charts, exact axes | `feat(analytics): charts and controls` |
| 10 | Stall: hero, listings (publish/deal), customise (name/tagline/colour), customer preview | Live preview updates | `feat(stall): listings and customisation` |
| 11 | Profile: view, edit, logo upload, change password, log out | Profile parity | `feat(profile): profile view and editing` |
| 12 | Delete old routes/components/dead code, remove unused deps, rewrite `README.md` + `docs/DATABASE_BRIEFING.md` | Clean tree, docs | `chore: remove legacy ui and update docs` |

### Per-phase quality gate

1. `npx tsc --noEmit`, `npm run lint`, `npm run build`.
2. Playwright at 430×932: screenshot the new screen and the corresponding prototype state;
   diff visually; fix spacing/type/colour/icon differences before committing.
3. Save pairs to `docs/ui-checks/<phase>-<screen>.png`.
4. Console must be error-free; check keyboard focus and Escape on sheets.
5. Push the branch after each commit.

---

## 8. Acceptance-test plan

| # | Test | How it will be verified |
| --- | --- | --- |
| 1 | Create account → log out → log in | Playwright against the real/local Supabase project; confirm vendor + stall rows created. |
| 2 | Jeans: price 27,000, cost 16,000, qty 9 → sell at 25,000 | Assert stock 8; sale `profit=9000`, `price_reduction=2000`; Home reductions +2,000; receipt shows "You saved UGX 2,000". |
| 3 | Add "Stock purchase" expense | Assert net profit (Home, Analytics, daily chart) unchanged; expenses total increases. |
| 4 | Home month dropdown | Select previous month; assert figures change to that month's aggregates. |
| 5 | Profit chart ranges | 7D, 30D, Custom all render; seed a negative-profit day and assert a red bar. |
| 6 | Publish/hide/discount | Toggle and assert customer-preview grid updates immediately without reload. |
| 7 | RLS isolation | Two users/vendors; attempt select/update/insert/delete across vendors via anon client; assert zero rows / policy errors. |
| 8 | Regression | `tsc`, `lint`, `build`, no console errors; screenshots for every screen at 430px. |

---

## 9. What I need from you to proceed

1. **Approve this plan** (or tell me what to change).
2. **Confirm the Supabase target:** is `akfktjvckvlfclkwjppn` correct and just paused? If not, send
   the new project ref/URL. Without a reachable project I can still build the UI and local
   migrations, but I cannot run the acceptance tests against your real backend.
3. **Confirm assumption 2** (reuse `finance_entries` instead of adding `expenses` /
   `other_income`). If you want the literal table names from the data model, I will add separate
   tables and migrate the existing ledger rows instead.
4. **Confirm assumption 1** (email/password auth, phone stored, no OTP) or tell me to wire phone
   OTP.
5. **Confirm that the removed feature routes** (bookings, customers, suppliers, reports, staff,
   damaged items, settings) are intentionally out of scope. Their database tables will stay.

No deletions or implementation work will start until you reply **go**.
