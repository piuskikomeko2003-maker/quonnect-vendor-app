# Database briefing

Supabase Postgres is the source of truth. Every business table is scoped by `vendor_id` and protected by RLS tied to `auth.uid()` through `public.vendors.user_id`.

## Migration set

| File | Role |
| --- | --- |
| `20260901_00_baseline.sql` | Reproducible base tables (`vendors`, `products`, `finance_entries`) and base RLS |
| `20260928_01_core_and_modular_schema.sql` | Existing modular schema (sales, customers, finance extensions, suppliers, etc.) |
| `20260928_02_report_stock_rpc.sql` | Existing stock report RPC |
| `20261021_01_ui_rebuild.sql` | UI rebuild schema, RLS, storage and aggregate RPCs |

The baseline is deliberately idempotent because the original base tables were created through the Supabase dashboard/MCP and were missing from migration history.

Apply with:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase gen types typescript --linked > src/types/database.types.ts
```

## Core tables

### vendors

One row per auth user. `user_id` is unique and references `auth.users`.

Rebuild columns added: `owner_name`, `phone2`, `email`, `motto`, `instagram`, `facebook`, `tiktok`, `whatsapp`, plus the existing `business_name`, `category`, `region`, `phone`, `logo_url`.

- Signup trigger `on_auth_user_created_vendor` creates the row from `raw_user_meta_data`.
- `ensureVendorProfile()` in the app repairs missing rows after email confirmation or older trigger gaps.

### stalls

Exactly one stall per vendor (`vendor_id UNIQUE`). Holds `name`, `tagline`, `accent_color`. A trigger (`create_stall_for_vendor`) creates it on vendor insert; existing vendors are backfilled. The accent drives `--accent` in the app shell and all derived CSS tokens.

### products

Existing fields are preserved. Mapping to the requested data model:

| Requested | Actual |
| --- | --- |
| `quantity` | `stock` |
| `image_url` | `photo_url` |
| `is_published` | `is_active` |

Added: `sizes text[]`, `colors text[]`, `discount_pct integer` (0–90), `stock NOT NULL DEFAULT 0`.

- `record_initial_stock` writes an `adjustment` movement when a product is created with stock.

### stock_movements

`product_id`, `delta` (negative for sales), `reason` (`sale` / `restock` / `adjustment`), `created_at`. Written by `create_sale`, `restock_product` and the initial-stock trigger. Stock should not be overwritten directly anywhere in the app.

### sales and sale_items

`sales` keeps the existing totals/status/payment fields and adds:

- `price_reduction numeric(14,2) NOT NULL DEFAULT 0`
- `customer_phone text`

`sale_items` keeps `unit_price` (sold price) and `unit_cost`, and adds:

- `listed_price numeric(14,2)`
- `sold_price numeric(14,2)`

Existing rows were backfilled with `unit_price`. New rows are always written by `create_sale`, so the snapshots cannot drift.

### finance_entries (ledger)

Used for both expenses and other income:

- `type = 'expense'` → expense. `category` is one of the expense categories. `notes` is the optional note.
- `type = 'income'` → other income. `category` is the income source.
- `entry_date` is the business date; `created_at` is the audit timestamp.
- `Stock purchase` rows are created by restocking (optional) and manually.

No duplicate `expenses` / `other_income` tables were added. This preserves existing data and keeps all ledger queries in one place. Every aggregate filters `category <> 'Stock purchase'` when computing operating costs.

### budgets

`vendor_id`, `category`, `monthly_limit`, unique `(vendor_id, category)`. Budget progress joins this month's expense rows whose category has a budget.

### Outer tables left in place

`customers`, `payments`, `bookings`, `suppliers`, `purchases`, `purchase_items`, `purchase_orders`, `quotations`, `activity_log`, `shop_members`, `stores`, `stock_levels`, `stock_transfers`, `product_images`, `shop_suggestions` remain from the previous app. They are not used by the rebuilt UI and stay protected by their existing RLS. No data is dropped.

## RLS

Ownership predicate used by the rebuilt policies:

```sql
EXISTS (
  SELECT 1 FROM public.vendors v
  WHERE v.id = <table>.vendor_id AND v.user_id = auth.uid()
)
```

- Rebuilt tables use `FOR ALL USING (...) WITH CHECK (...)`.
- `vendors` has explicit select/insert/update policies on `auth.uid() = user_id`.
- `products` is vendor-scoped only; the customer preview reads the owner's rows.
- New tables (`stalls`, `stock_movements`, `budgets`) have RLS enabled with the same predicate.

Storage bucket `vendor-assets` is public-read. Writes are restricted to folders matching the signed-in user id (signup logo) or one of their vendor ids (product photos and profile logo).

## RPCs

### `create_sale(p_vendor_id, p_items, p_payment_method, p_customer_name, p_customer_phone)`

One transaction:

1. Asserts the caller owns the vendor.
2. Locks each product row (`FOR UPDATE`).
3. Rejects quantities above stock.
4. Computes effective listed price and takes the per-line sold price.
5. Inserts the sale, decrements stock and writes `stock_movements`.
6. Inserts `sale_items` with `listed_price`, `sold_price`, `unit_cost`.
7. Updates the sale totals, profit and price reduction.

Returns `{sale_id, order_no, total, profit, price_reduction}`.

### `restock_product(p_vendor_id, p_product_id, p_qty, p_new_cost, p_create_expense)`

Locks the product, increments stock, optionally updates cost, writes a `restock` movement, and optionally inserts a `Stock purchase` expense for `qty × cost`.

### Aggregates

| Function | Returns |
| --- | --- |
| `vendor_daily_series(vendor, from, to)` | per-day sales, gross profit, price reduction, expected revenue, expenses, operating expenses, other income, net profit |
| `vendor_monthly_series(vendor, months)` | same by month, plus COGS |
| `vendor_home_overview(vendor, month)` | today/yesterday stats, selected-month summary, previous-month net, budget spend, low stock JSON |
| `vendor_recent_transactions(vendor, limit)` | unified sale/expense/income feed (default 40) |
| `vendor_expense_categories(vendor, from)` | category totals since a date |
| `vendor_item_stats(vendor)` | average cost/expected/actual per item, top 8 by units sold |

These are `SECURITY INVOKER` and call `assert_vendor_owner(p_vendor_id)` before aggregating. No dashboard or analytics rows are loaded into the browser.

## Definitions

```
net profit = gross profit + other income − Σ(expenses where category <> 'Stock purchase')
sale profit = Σ((sold_price − unit_cost) × qty)
price reduction = Σ((listed_price − sold_price) × qty)
effective price = price × (1 − discount_pct / 100)
budget used = Σ(this month's expenses in budgeted categories) / Σ(budget limits)
```

Business dates use `Africa/Kampala`: `(now() AT TIME ZONE 'Africa/Kampala')::date`.

## Demo seed

`scripts/seed-demo.ts` is dev-only and uses the service-role key. It creates/repairs a demo auth user, vendor, stall, products, 8 months of sales and expenses, and budgets. It is never imported by the app.

```bash
npm run seed:demo -- --email demo@quonnect.test --reset
```
