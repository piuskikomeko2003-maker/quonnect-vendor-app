# AUDIT.md — Phase 0

**Date:** 2 November 2026 (amended with the owner's decisions and plan amendments, same day)  
**Scope:** audit only. No source, schema, or migration files were changed. `AUDIT.md` is the only file created.  
**App:** Next.js 16.3.5 + Supabase, vendor finance app for Uganda (UGX).

**Docs read:** `SPEC.md`, `FUTURE.md`, and `docs/FINANCE_AND_STOCK_LOGIC.md`.  
The path requested (`docs/finance-logic.md`) does not exist; the finance document in this repo is `docs/FINANCE_AND_STOCK_LOGIC.md`.

**Important:** where the finance document and the code disagree, the code is treated as correct. Two such disagreements are noted below.

---

## 0. Test and build output (real, this machine)

### 0.1 Unit tests — PASS

```text
$ npm run test:unit

> quonnect-vendor-app@0.1.0 test:unit
> tsx scripts/unit-tests.ts

PASS  money is integer UGX
PASS  formatMoney keeps full amounts by default
PASS  formatMoney can omit the currency label
PASS  formatMoney compacts very large amounts
PASS  formatUGX delegates to formatMoney
PASS  chart short labels
PASS  effective price applies discount
PASS  nice axes use about four steps
PASS  profit bars stay clear of the date labels
PASS  all-zero profit bars show the empty state
PASS  custom charts are capped at 60 days
PASS  business month follows the configured start day
PASS  feature flags default on for existing vendors and respect explicit values
PASS  new vendor feature defaults keep optional features off
PASS  feature defaults never overwrite explicit flags
PASS  Uganda WhatsApp numbers
PASS  receipt text contains savings and total
PASS  legacy product cover is used when no gallery exists
PASS  product galleries are de-duplicated and capped at eight
PASS  product photo add keeps the limit and existing order
PASS  product photos can be removed and reordered without mutation

21 unit tests passed
exit 0
```

What these tests actually cover: formatting, chart geometry, effective price, business-month key, feature-flag resolution, WhatsApp numbers, receipt text, and product-image helpers. They do **not** exercise any database RPC, sale, expense, stock, payment, account, RLS, concurrency, or migration.

### 0.2 Acceptance tests — CANNOT RUN HERE

```text
$ npm run test:acceptance

> quonnect-vendor-app@0.1.0 test:acceptance
> tsx scripts/acceptance-tests.ts

◇ injected env (2) from .env.local
Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
exit 1
```

`.env.local` contains the URL and anon key, but **no `SUPABASE_SERVICE_ROLE_KEY`**. The acceptance suite creates temporary users with the admin API, so it cannot run without that key. I did not invent a key or point the app at a random project.

`docs/ACCEPTANCE_REPORT.md` records **19/19 passing on 2026-10-21** against project `akfktjvckvlfclkwjppn`. That is a historical report, not a current run. The current `scripts/acceptance-tests.ts` contains 19 checks.

### 0.3 Typecheck — PASS

```text
$ npx tsc --noEmit
TYPECHECK_EXIT=0
```

### 0.4 Lint — source clean, repository lint script not scoped

```text
$ npx eslint src scripts
✖ 1 problem (0 errors, 1 warning)
ESLINT_SRC_EXIT=0
```

The one warning is `src/actions/auth.ts:192` (`window.location.assign()` for an internal route).

```text
$ npm run lint
✖ 1 problem (0 errors, 1 warning)
LINT_EXIT=0
```

Before the Milestone A fix, `npm run lint` was unscoped (`eslint` with no paths) and walked generated Android build assets under `android/app/build/...`, reporting 5,901 problems (104 errors). `android/**` was added to `globalIgnores` in `eslint.config.mjs`; the source tree itself was already clean.

### 0.5 Production build — PASS

```text
$ npm run build
✓ Compiled successfully
✓ Finished TypeScript
✓ Generating static pages (33/33)
BUILD_EXIT=0
```

---

## 1. What works and should be kept

These are real, inspected behaviours worth preserving rather than rewriting.

### 1.1 The sale transaction is the strongest part of the system

`create_sale` in `supabase/migrations/20261021_01_ui_rebuild.sql` (lines 329–437) is genuinely transactional and does several things correctly:

- Asserts vendor ownership through `assert_vendor_owner` (lines 311–327).
- Locks each product row with `FOR UPDATE` before checking/selling stock (lines 378–382).
- Rejects a sale when `stock < qty` (lines 388–390).
- Recomputes `listed_price` in SQL from the product's price/discount, rather than trusting the browser (line 392).
- Snapshots `unit_cost` at sale time (line 394).
- Computes `total`, `profit`, and `price_reduction` in SQL (lines 400–402).
- Decrements stock and writes a `stock_movements` row in the same transaction (lines 404–409).
- Stores `listed_price`, `sold_price`, and `unit_cost` on each `sale_items` row (lines 411–418).
- Rolls the whole sale back if any line fails.

Sales therefore keep their historical cost basis even if the product cost changes later. That is the right foundation for Stage 2/3 and should not be rebuilt.

### 1.2 RLS is consistently vendor-scoped

RLS is enabled on all 25 public tables created by the migrations. The ownership predicate is consistent:

```sql
EXISTS (
  SELECT 1 FROM public.vendors v
  WHERE v.id = <table>.vendor_id AND v.user_id = auth.uid()
)
```

Examples:

- `products`, `finance_entries`: `20260901_00_baseline.sql` lines 52–78.
- `sales`, `sale_items`, `payments`, `customers`: `20260928_01_core_and_modular_schema.sql` lines 97–212.
- `stalls`, `stock_movements`, `budgets`: `20261021_01_ui_rebuild.sql` lines 100–120.
- `finance_categories` and `product_categories`: later migrations.

The RPCs are `SECURITY INVOKER` and call `assert_vendor_owner`, so RLS remains the outer boundary. The legacy `report_stock` RPC that allowed a `NULL` viewer id to read another vendor's stock is created in `20260928_02_report_stock_rpc.sql` but explicitly dropped in `20261021_01_ui_rebuild.sql` line 306. The full migration set therefore closes that hole.

### 1.3 The customer receipt does not leak cost or profit

`src/lib/receipt.ts` renders items, quantities, sold prices, listed-price savings, total, and payment method (`receiptText` lines 33–49; canvas `buildReceipt` lines 215–281). It does **not** render unit cost or profit. The `ReceiptSale` object contains `profit`, but it is not drawn. Keep that rule.

### 1.4 Money display is centralised

`src/lib/format.ts` is the single display formatter:

- `formatMoney` always shows full UGX and rounds at display boundaries (lines 20–43).
- `formatUGX` delegates to it.
- `businessMonthKey` correctly shifts a date to the business month containing it (lines 113–118).
- `todayKey` uses `Africa/Kampala` (lines 98–107).

The unit tests cover these helpers.

### 1.5 Business-date handling already uses Kampala in the important SQL paths

`create_sale`, `restock_product`, `vendor_daily_series`, `vendor_monthly_series`, and `vendor_home_overview` all use `(now() AT TIME ZONE 'Africa/Kampala')::date` or equivalent. This is the correct base for the one-helper rule.

### 1.6 Useful schema foundations already exist

- `sales` and `sale_items` are separate from `payments` and stock, which is the right separation for Stage 2/3.
- `payments` table exists with vendor/sale/customer/amount/method/date and RLS, even though the app does not use it yet.
- `stock_movements` exists with product/vendor/delta/reason and indexes.
- `activity_log` exists (unused) and could be used as a starting point, though SPEC asks for `audit_logs`.
- `vendors.month_start_day`, `products.min_stock_alert`, `products.quantity_unit`, `products.sku`, `products.deleted_at`, and `finance_entries.deleted_at` already exist as columns even where the UI ignores them.
- `customers`, `suppliers`, `purchases`, `purchase_items`, `damaged_items`, `stores`, `stock_levels`, and `stock_transfers` tables exist from an earlier modular schema and are RLS-protected. They are currently unused by the rebuilt UI. They must not be dropped; some are useful later.

### 1.7 Build and typecheck are healthy

The app builds, typechecks, and its source passes ESLint (apart from the warning above). The unit suite passes. This is a good baseline to extend, not rewrite.

---

## 2. What is financially wrong, ranked by severity

Severity is about the risk to a vendor's money/reporting, not code style. Each item cites the file and function where the behaviour lives.

### F1 — CRITICAL: weighted-average costing does not exist; restocking replaces the cost

**Evidence**

- `supabase/migrations/20261021_01_ui_rebuild.sql` → `restock_product`, lines 471–476:

  ```sql
  v_cost := COALESCE(p_new_cost, v_product.cost, 0);
  UPDATE public.products
  SET stock = COALESCE(stock, 0) + p_qty,
      cost = v_cost
  ```

- `create_sale` reads `v_cost := COALESCE(v_product.cost, 0)` (line 394) and uses it for every unit sold.
- `src/actions/business.ts` → `updateProductAction` writes `cost` from the form (lines 202–204).

**Why it is wrong**

SPEC section 2 requires weighted-average cost:

```text
new_avg = (old_qty × old_avg + buy_qty × buy_cost) / (old_qty + buy_qty)
```

The current code throws away `old_avg`. After 10 units at 5,000 and 10 units at 7,000:

- Current code: 20 units at 7,000 = stock value 140,000, future COGS 7,000/unit.
- SPEC: average 6,000, stock value 120,000, future COGS 6,000/unit.

This also fails SPEC acceptance tests 6 and 7, and it means “Stock value” and “Expected profit” on the Stock screen are not accounting inventory values.

**Impact:** wrong inventory value, wrong future profit, wrong margin, wrong stock-value card. This is a Stage 1 blocker.

---

### F2 — CRITICAL: credit, partial, and split-payment sales are not supported; every sale is forced fully paid in Cash

**Evidence**

- `supabase/migrations/20261021_01_ui_rebuild.sql` → `create_sale`, lines 364–371 inserts `status = 'completed'`, `paid_amount = 0`, and then lines 421–427 sets `paid_amount = v_total` unconditionally.
- `sales.due_amount` is never written anywhere; it stays at its default 0 (`20260928_01_core_and_modular_schema.sql` line 123).
- `src/actions/business.ts` → `recordSaleAction` hardcodes `p_payment_method: "Cash"` (line 407) and returns `payment_method: "Cash"` (line 461).
- `SellScreen.tsx` has no payment selector at sale time. Payment method is only changed later on the receipt (`saveReceiptAction`, lines 468–522).
- Profit queries do not filter by `status` or `paid_amount`; any non-deleted sale counts in full (`vendor_daily_series` lines 537–541, `vendor_monthly_series` lines 599–606, `vendor_home_overview` lines 848–882).

**Why it is wrong**

SPEC section 3 and Phase 1a require sales to support fully paid, partial, unpaid (credit), and split payments, with status derived from payments. In the current system:

- A credit sale cannot be recorded.
- A partial payment cannot be recorded.
- “Customers owe you” cannot be computed.
- Cash received is assumed equal to sales, so profit and cash are conflated.
- If a credit sale were inserted directly into `sales`, it would count fully as revenue/profit and as zero cash — with no payment/account rows to reconcile it.

**Impact:** fails SPEC acceptance tests 2, 3, and 4 and blocks Phase 1a.

---

### F3 — CRITICAL: there is no cash/account model at all

**Evidence**

- Searches for `financial_accounts` and `account_transactions` find them only in `SPEC.md` and `FUTURE.md`; no migration or source file creates or uses them.
- `src/actions/business.ts` → `addExpenseAction` inserts only into `finance_entries` (lines 534–543).
- `restock_product` inserts only a `finance_entries` row when the checkbox is ticked (lines 481–488).
- `addIncomeAction` inserts only into `finance_entries` (lines 623–631).
- `payments` table exists but no app code reads or writes it (grep found no `payments` usage in `src/`).

**Why it is wrong**

SPEC section 3 requires “Money you have” = sum of active account balances, and “Net cash flow” = cash in − cash out. Neither exists. The app can say “profit” but cannot answer “how much money is in the till?”. Restocking records a cash-out *expense* but does not reduce any account; a sale records revenue but does not add to any account.

**Impact:** Phase 1a blocker; all of Home’s required cards and the Money → Accounts section are impossible today.

---

### F4 — HIGH: stock purchases are classified by an exact category string, and editing a category changes profit retroactively

**Evidence**

- `vendor_daily_series` lines 543–545: `SUM(amount) FILTER (WHERE category <> 'Stock purchase')`.
- `vendor_monthly_series` lines 608–610: same.
- `vendor_home_overview` lines 863, 869, 896, 920: same.
- `src/actions/business.ts` → `updateExpenseAction` lets the user change category, amount, and date on an existing expense (lines 574–586). No audit row, no reversal.
- `addExpenseAction` accepts arbitrary custom categories (lines 524–543), and `rememberCategory` stores them.

**Why it is wrong**

SPEC section 2 says: “Never decide accounting treatment from a category string.” The current code does exactly that. A vendor who types `stock purchase`, `Stock`, `Restock`, or a local-language equivalent will have that purchase deducted from net profit a second time (it is already in COGS when the units sell). Changing an old expense from `Stock purchase` to `Transport` silently rewrites historical profit.

**Impact:** double-counted costs, understated profit, and non-auditable profit changes. This is one of the most likely real-world misstatements in the app.

---

### F5 — HIGH: direct product editing bypasses `stock_movements` and rewrites cost

**Evidence**

- `src/actions/business.ts` → `updateProductAction`, lines 194–212 writes `stock: quantity` and `cost: ...` directly.
- `src/components/screens/ProductSheet.tsx` lines 310–311 exposes Quantity and Cost fields on edit.
- `products.stock` has a database `CHECK (stock >= 0)` but no trigger prevents direct writes.
- `products.cost` has no check constraint at all.
- `stock_movements.reason` is limited to `sale`, `restock`, `adjustment` (`20261021_01_ui_rebuild.sql` line 76).

**Why it is wrong**

SPEC section 2 says `products.stock` may only change through DB functions that write a `stock_movements` row, and `products.cost` may only change through purchase/adjustment functions. Today the edit form is an escape hatch: it changes stock without a movement, changes cost without an audit record, and can make the sum of movements disagree with `products.stock`.

**Impact:** fails SPEC acceptance test 18; breaks the audit trail; makes weighted average impossible to trust.

---

### F6 — HIGH: no idempotency anywhere

**Evidence**

- No `idempotency_key` column exists in any migration.
- `create_sale` has no idempotency parameter and no unique constraint on `order_no` or any client key.
- `recordSaleAction`, `addExpenseAction`, `addIncomeAction`, `restockProductAction`, and `saveReceiptAction` have no request key.
- The UI disables the button while `busy`, but a network retry, double submit on a flaky connection, or a second tab can duplicate the operation.

**Impact:** a duplicated sale double-decrements stock and double-counts revenue/profit; a duplicated expense doubles spending; a duplicated payment doubles cash. Fails SPEC acceptance test 11 and section 1.6 (“idempotent”).

---

### F7 — HIGH: financial history is editable and deletable; corrections are not reversals

**Evidence**

- Baseline RLS gives `products` and `finance_entries` `FOR ALL` (including UPDATE/DELETE) to the owning vendor: `20260901_00_baseline.sql` lines 68–78.
- The modular schema gives `sales`, `sale_items`, `payments`, and `customers` `FOR ALL`: `20260928_01_core_and_modular_schema.sql` lines 143–212.
- `updateExpenseAction` edits historical amounts/dates/categories (lines 563–611).
- `saveReceiptAction` changes a sale's payment method after the sale (lines 508–517).
- There is no `audit_logs` table and no void/reversal RPC.

**Why it is wrong**

SPEC section 1.5: “Financial history is never silently rewritten. Corrections are reversals, not edits/deletes.” The current model allows a vendor (or anyone with the vendor's token) to rewrite `sales.total`, `sales.profit`, `sale_items.unit_cost`, `finance_entries.amount`, or delete rows. Reports would change without a trace.

**Impact:** fails SPEC section 8 audit requirements and acceptance test 15; makes later period closing/reconciliation unsafe.

---

### F8 — HIGH: initial stock has no opening value, no purchase, and the wrong movement type

**Evidence**

- `record_initial_stock` in `20261021_01_ui_rebuild.sql` lines 231–249 inserts a movement with `reason = 'adjustment'` and no cost/value.
- Product creation writes `stock` directly (`createProductAction`, lines 150–164), and the trigger fires.
- The finance doc (section 4.4) confirms: initial stock has a cost basis for future COGS but no cash-out entry.

**Why it is wrong**

SPEC section 2 lists `initial` as a movement type and section 6 says existing stock becomes one `initial` movement at its current cost and quantity, with an inventory opening value. The current `adjustment` movement cannot distinguish opening stock from a correction, and there is no opening inventory/equity representation. The reconciliation identity therefore has no clean starting point.

**Impact:** opening inventory value and the cash/profit reconciliation cannot be proven.

---

### F9 — HIGH: UGX rounding is not enforced once at write time; sales can store decimals

**Evidence**

- Money columns are `numeric(14, 2)` (baseline `products`, `sales`, `sale_items`, `finance_entries`, etc.).
- `create_sale` rounds only `listed_price` to 2 decimals (line 392). `sold_price` is accepted raw (line 393), and line totals/profit are not rounded (lines 400–402).
- `recordSaleAction` rounds the value it returns for display (`Math.round(Number(line.sold_price))`, line 395) but sends the unrounded `line.sold_price` to SQL (lines 402–406).
- `effectivePrice` rounds in the browser (`src/lib/product.ts` lines 4–6), while the database computes its own listed snapshot at 2 decimals.
- `formatMoney` rounds again for display (`src/lib/format.ts` lines 41–42).

**Why it is wrong**

SPEC section 2: “UGX has no decimals. Round once, in the DB, at write time. The UI displays stored values and does not re-round separately.” Today there are at least three rounding points (browser effective price, DB listed snapshot, display formatter) and `sold_price` can carry decimals. Two screens can legitimately differ by one shilling on the same sale.

**Impact:** fails the “1 shilling” consistency requirement; makes totals harder to reconcile; invites disputes on receipts vs reports.

---

### F10 — HIGH: `month_start_day` applies only to Home; Analytics, budgets, and the server overview remain calendar-month

**Evidence**

- `src/app/(app)/home/page.tsx` lines 40–43 chooses the month with `businessMonthKey(today, vendor.month_start_day)`.
- `HomeScreen.tsx` lines 228–293 implements the business-month window and previous-period comparison.
- `vendor_monthly_series` always anchors on `date_trunc('month', ...)` (`20261021_01_ui_rebuild.sql` lines 570–580).
- `vendor_home_overview` computes its month from `(v_selected || '-01')::date` (line 845), not `month_start_day`.
- `loadMoney` uses `monthStartKey(currentMonthKey())` (line 133), a calendar month.
- `loadAnalytics` uses `monthStartKey(monthsAgoKey(months - 1))` (line 226), calendar months.
- The budget query in `vendor_home_overview` uses `v_current_month` (lines 924–928), calendar month.

**Why it is wrong**

SPEC section 2 says `month_start_day` must apply to Home, Analytics, Budgets, and Reports “everywhere or nowhere.” Today it is Home-only. A vendor with a 25th-start month sees different monthly totals on Home vs Analytics vs Budgets.

There is a second date-helper issue: `monthsAgoKey` and `monthList` use the browser's local `new Date()` (`src/lib/format.ts` lines 138–141, 152–154), while `todayKey` uses Kampala. Near midnight, Analytics range boundaries can be off by a day/month relative to the business day. `formatDateTime` also uses the device timezone (lines 88–96).

**Impact:** fails SPEC acceptance tests 16 and 17; vendors cannot trust “this month” across screens.

---

### F11 — HIGH: Analytics ranges and item stats are inconsistent with the selected period

**Evidence**

- `vendor_item_stats` groups sold rows by `si.product_name` (`20261021_01_ui_rebuild.sql` lines 675–685) and joins sold rows to products by name (line 711). Duplicate names merge; renamed products misalign.
- `vendor_item_stats` is all-time: it has no date parameters (lines 664–719). The “By item” comparison is therefore not limited to the selected Analytics range.
- `loadAnalytics` loads the expense category breakdown from `monthStartKey(monthsAgoKey(months - 1))` (line 226), not from the selected chart range (lines 237–240).
- `vendor_expense_categories` has only a lower bound (`entry_date >= p_from`, lines 652–657); it has no upper bound and no `deleted_at` filter.
- Home’s monthly “Price reductions given” sums raw `price_reduction` from the daily series (`HomeScreen.tsx` lines 295–314). Analytics computes `max(0, expectedTotal - actualTotal)` (`AnalyticsScreen.tsx` lines 122–124). `vendor_home_overview` uses `GREATEST(price_reduction, 0)` (lines 880–882), but Home does not render that server field. **Doc drift:** `docs/FINANCE_AND_STOCK_LOGIC.md` section 7.5 says Home uses only `GREATEST(price_reduction, 0)`; the current Home screen does not — it sums the raw daily value.

**Why it is wrong**

The numbers on screen are not answering the question the range selector asks. “Where the money went” can cover 12 months while the chart says 7 days. “Cost vs expected vs actual” can merge two different products with the same name. Discounts and premiums are treated differently on Home vs Analytics.

**Impact:** wrong business decisions; fails the SPEC inconsistency list.

---

### F12 — MEDIUM: low-stock alerts ignore `min_stock_alert`

**Evidence**

- `vendor_home_overview` hardcodes `stock <= 3` (`20261021_01_ui_rebuild.sql` line 951).
- `StockScreen.tsx` badges use `stock <= 0` and `stock <= 3` (line 183).
- `products.min_stock_alert` exists (`20260928_01_core_and_modular_schema.sql` line 32) but is not read by any screen.

**Impact:** a product with a per-product threshold of 10 is not flagged until it reaches 3; a product with a threshold of 1 is flagged too early. SPEC section 5 requires per-product min stock.

---

### F13 — MEDIUM: expense frequency is cosmetic and income can only be dated today

**Evidence**

- `addExpenseAction` stores `frequency` (`daily`/`monthly`) but nothing consumes it except a UI tag (`MoneyScreen.tsx` lines 160–166).
- `addIncomeAction` always stores `entry_date: todayKey()` (lines 623–631); there is no date field in `IncomeSheet` (`MoneyScreen.tsx` lines 453–525).

**Impact:** “Monthly” does not create a recurring charge or prorate anything. Historical other income cannot be recorded accurately. SPEC section 2 says frequency is not a real behaviour; it should not imply one.

---

### F14 — MEDIUM: budgets are calendar-month, cannot be deleted, and stock purchases can consume them

**Evidence**

- `setBudgetAction` upserts one limit per `(vendor_id, category)` (`src/actions/business.ts` lines 637–658). There is no delete action.
- `vendor_home_overview` joins budgets to expenses by category in the current calendar month (lines 924–928), without filtering `deleted_at` or `kind`.
- The Money screen shows calendar-month spend from `loadMoney` (`data.ts` lines 132–153).
- Stock purchase expenses count against a `Stock purchase` budget, even though they are excluded from net profit.

**Impact:** budgets do not follow the business month; a vendor cannot remove a budget; “budget used” can conflict with profit.

---

### F15 — MEDIUM: soft deletes are applied inconsistently, and deleted products remain sellable

**Evidence**

- Sales queries filter `deleted_at IS NULL` in the daily/monthly/home aggregate functions.
- Expense aggregates do **not** filter `deleted_at`: `vendor_daily_series` lines 542–551, `vendor_monthly_series` lines 607–623, `vendor_home_overview` lines 854–897, `vendor_expense_categories` lines 652–657, `vendor_recent_transactions` lines 782–797.
- `loadProducts` does not filter `deleted_at` (`src/lib/data.ts` lines 267–277), so Stock totals include soft-deleted products.
- `loadSell` does not filter `deleted_at` (`data.ts` lines 113–122), and `create_sale` does not check `deleted_at` on the product (`20261021_01_ui_rebuild.sql` lines 378–382). A soft-deleted product can still be sold.
- `loadMoney` does not filter `deleted_at` on expenses or income (lines 136–149).
- `loadSell` recent sales also does not filter deleted sales.

**Impact:** reports can include removed rows; stock value can include removed products; a “deleted” product can still be sold. SPEC section 2 requires reports to filter reversed rows consistently in one place.

---

### F16 — MEDIUM: customer totals are denormalised, non-atomic, and not derived from sales/payments

**Evidence**

- `saveCustomerForSale` in `src/actions/business.ts` lines 286–335 reads `total_orders`/`total_spent`, adds to them in JavaScript, and writes them back.
- Customer matching is by phone if present, otherwise by `ilike("name", cleanName)` (lines 297–304). `%` and `_` are not escaped.
- `saveCustomerForSale` runs after `create_sale`, not inside the sale transaction (lines 419–449). If it fails, the sale still exists.
- `saveReceiptAction` can attach an existing customer to a sale (lines 484–517) but does not update that customer's `total_spent`.
- `customers.due_amount` is never updated.
- Customer screen totals are sums of the stored denormalised fields (`CustomersScreen.tsx` lines 40–41), not derived from sales/payments.

**Impact:** customer spend/order counts can drift or be lost; two sales for the same customer can overwrite each other; “Customers owe you” is impossible. SPEC section 5 requires balance/history/record payment.

---

### F17 — MEDIUM: “Income” means different things on Home and Money, and cash is labelled as profit elsewhere

**Evidence**

- `HomeScreen.tsx` lines 391–398 labels `extras.income_today` as “Income”.
- `data.ts` `incomeOn` computes `sales + other_income` (lines 71–74). So Home’s “Income” is total inflow.
- `MoneyScreen.tsx` “Income” is only `finance_entries.type = 'income'` (lines 196–223), i.e. other income.
- `HomeScreen` “Expenses” is all expenses including stock purchases, while “Profit” excludes stock purchases (lines 400–416, 694–732).
- The Stock screen labels expected revenue/profit, not accounting inventory value (`StockScreen.tsx` lines 46–55, 104–130).

**Impact:** a vendor compares “Income” on two screens and gets different numbers. SPEC section 3 explicitly forbids mixing sales with cash received and profit with money on hand.

---

### F18 — MEDIUM: stock value and expected profit use current cost and current discount, not weighted historical cost

**Evidence**

- `StockScreen.tsx` `totals` (lines 46–55) computes `cost × stock` and `effectivePrice × stock` from the current product row.
- `effectivePrice` applies the current `discount_pct`.
- The finance doc section 4.2 documents this.

**Impact:** this is not “stock value” in the SPEC sense (Σ stock × weighted-average cost). It is a current-price retail estimate. Once F1 is fixed, the Stock screen must switch to weighted-average cost for stock value and keep expected revenue as a separate, clearly labelled projection.

---

### F19 — LOW: order numbers are random and not unique

**Evidence**

- `create_sale` line 361–362 builds `S-YYMMDD-NNNN` from `floor(random() * 9000) + 1000`.
- There is no unique constraint on `sales.order_no`.

**Impact:** two sales on the same day can receive the same order number. Receipts reference `R-<sale uuid prefix>` separately, but the order number is still not a reliable reference for support/reconciliation.

---

### F20 — LOW: some invalid quantities/costs are silently coerced instead of rejected

**Evidence**

- `create_sale` line 376: `v_qty := GREATEST(1, COALESCE(...))`. A client sending `qty = 0` or `qty = -5` sells 1 unit instead of returning an error.
- `create_sale` line 396 rejects only `v_sold < 0`; a free sale at 0 is allowed by the RPC even though the UI blocks it.
- `restock_product` line 471 accepts `p_new_cost = 0` and revalues the product to zero.

**Impact:** data integrity / trust issue; a bad client or direct API call can produce surprising money results.

---

### F21 — LOW: status/payment-method/frequency text fields are unconstrained strings

**Evidence**

- `sales.status` is `text` with a comment listing values but no `CHECK` (`20260928_01_core_and_modular_schema.sql` line 125).
- `sales.payment_method` is `text` with no check (line 126).
- `payments.payment_method` is `text` with no check (line 192).
- `finance_entries.frequency` has a check (`daily`/`monthly`), but `finance_entries.type` is checked only as income/expense.

**Impact:** a direct write can create `status = 'whatever'` or an unknown payment method. Reports currently ignore status, so this is latent rather than active, but it blocks derived-status work.

---

## 3. Security and data-integrity risks

### S1 — CRITICAL: the “server actions” are actually browser code; RLS is the only enforcement boundary

**Evidence**

- No file under `src/` contains `"use server"` (grep returned nothing).
- `src/actions/business.ts` uses the browser Supabase client via `requireVendor()` → `getVendorContext()` → `createClient()` from `src/lib/supabase/browser.ts`.
- Client components import these functions directly: `SellScreen.tsx` line 5, `StockScreen.tsx` lines 5–11, `MoneyScreen.tsx` lines 5–11, `CustomersScreen.tsx` line 5.
- The app layout is client-side (`VendorProvider.tsx`); there is no server guard in the current tree (`src/proxy.ts` is deleted).

**Why it matters**

`recordSaleAction` and `restockProductAction` do call SQL RPCs that revalidate, which is good. But `addExpenseAction`, `updateExpenseAction`, `addIncomeAction`, `setBudgetAction`, `createProductAction`, `updateProductAction`, `addCustomerAction`, and `saveReceiptAction` write PostgREST tables directly from the browser. A user can call the same PostgREST endpoint with their own JWT and bypass every JavaScript validation (rounding, category cleaning, positive amount, etc.). RLS correctly prevents cross-vendor access, but it does **not** enforce financial rules inside a vendor.

**Risk:** a vendor (or a compromised token/XSS) can insert/update/delete financial rows directly. SPEC section 8 says “Never trust the client for amounts, costs, or ownership. Server/RPC recalculates.” That is not true for most write paths today.

### S2 — CRITICAL: financial tables grant UPDATE/DELETE to the vendor, so history is mutable

**Evidence**

- `finance_entries` and `products`: `20260901_00_baseline.sql` lines 68–78 (`FOR ALL`).
- `sales`, `sale_items`, `payments`, `customers`: `20260928_01_core_and_modular_schema.sql` lines 143–212 (`FOR ALL`).
- `stock_movements`, `budgets`: `20261021_01_ui_rebuild.sql` lines 110–120 (`FOR ALL`).
- No `audit_logs`, no append-only guard, no revocation of UPDATE/DELETE.

**Risk:** a vendor can rewrite `sales.total`, `sales.profit`, `sale_items.unit_cost`, delete a sale, delete an expense, or delete a stock movement. Reports and profit become editable without trace. This directly violates SPEC section 1.5 and section 8.

### S3 — HIGH: `products.stock` and `products.cost` are writable directly; no DB guard

**Evidence**

- `updateProductAction` writes both columns (`src/actions/business.ts` lines 194–212).
- There is no trigger preventing direct `UPDATE products SET stock = ...` or `cost = ...`.
- `stock_movements` is only written by `create_sale`, `restock_product`, and the initial-stock trigger.
- `products.cost` has no non-negative check.

**Risk:** stock integrity (acceptance test 18) can be broken by any direct API call; weighted average can be poisoned; cost can be negative.

### S4 — HIGH: `finance_entries` can be written directly with arbitrary category/amount/date

**Evidence**

- RLS allows `FOR ALL` on `finance_entries` (baseline lines 74–78).
- `addExpenseAction`/`addIncomeAction` are client-side convenience wrappers, not a security boundary.
- There is no `kind` column, no `account_id`, no `created_by`, and no idempotency key.

**Risk:** profit can be manipulated by inserting an expense with a category other than `Stock purchase`; a vendor can also backdate or future-date entries directly. The server-side aggregate functions will trust it.

### S5 — HIGH: `sales`/`sale_items` snapshots can be edited after the fact

**Evidence**

- `FOR ALL` RLS on `sales` and `sale_items` (modular lines 143–183).
- `create_sale` writes the snapshots, but nothing prevents a later direct `UPDATE sale_items SET unit_cost = ...` or `UPDATE sales SET total = ...`.
- `saveReceiptAction` already changes `payment_method` after the sale without an audit/payment row (lines 508–517).

**Risk:** historical COGS/profit can be rewritten; a receipt can claim a different payment method than the one used at sale time.

### S6 — HIGH: no idempotency and no unique sale/order key

**Evidence:** as F6. `order_no` is random and not unique; no client request key.

**Risk:** duplicate sales/payments/expenses on retry. This is a data-integrity and money risk, not just UX.

### S7 — HIGH: the rollback SQL is inside `supabase/migrations/` and would drop financial tables

**Evidence**

- `supabase/migrations/20260928_01_rollback.sql` lines 5–21:

  ```sql
  DROP TABLE IF EXISTS public.stock_transfers CASCADE;
  ...
  DROP TABLE IF EXISTS public.payments CASCADE;
  DROP TABLE IF EXISTS public.sale_items CASCADE;
  DROP TABLE IF EXISTS public.sales CASCADE;
  DROP TABLE IF EXISTS public.customers CASCADE;
  ```

- The directory contains both `20260928_01_core_and_modular_schema.sql` and `20260928_01_rollback.sql`. Sorted lexically, the rollback comes directly after the forward migration.
- Supabase treats every `.sql` in `supabase/migrations` as a migration. Depending on version parsing, this is either a duplicate `20260928_01` version or the “next” migration; either way it is not a safe rollback artifact.

**Risk:** a future `supabase db push`/`db reset` on a fresh or linked project can either fail on a duplicate version or execute DROP TABLE ... CASCADE on sales/payments/customers. This is the single most dangerous deployment risk I found. It must be moved out of `supabase/migrations` (e.g. `supabase/rollbacks/`) before any migration work. The `APPLY_ON_DASHBOARD.sql` bundle does **not** contain the rollback, so dashboard-applied projects are currently safe; the migration path is not.

### S8 — MEDIUM: the legacy `report_stock` function is a cross-vendor read if the later migration is not applied

**Evidence**

- `supabase/migrations/20260928_02_report_stock_rpc.sql` defines `report_stock` as `SECURITY DEFINER` and treats `p_viewer_user_id IS NULL` as owner (lines 1–100).
- `20261021_01_ui_rebuild.sql` line 306 drops it.
- `APPLY_ON_DASHBOARD.sql` includes the drop at line 1124.

**Risk:** if a project is only migrated through 20260928, any authenticated caller can pass a null viewer id and read another vendor's stock. The full current migration set is safe; the intermediate state is not. Do not restore this function.

### S9 — MEDIUM: customer matching uses unescaped `ILIKE` patterns and non-atomic totals

**Evidence:** `saveCustomerForSale` (`src/actions/business.ts` lines 297–318) uses `.ilike("name", cleanName)`; `%` and `_` are wildcards. Totals are read-modify-write in JavaScript, outside the sale transaction.

**Risk:** a customer name containing `%` can match the wrong row; concurrent sales can lose totals; a failed customer write leaves a sale with no customer while the sale remains valid.

### S10 — MEDIUM: storage bucket is public-read

**Evidence**

- `vendor-assets` bucket is created with `public = true` (`20261021_01_ui_rebuild.sql` lines 254–256).
- Select policy allows anyone to read the bucket (lines 258–260).
- Write policies restrict folders to the user id or one of the user's vendor ids (lines 262–302).

**Risk:** product photos and logos placed in this bucket are publicly readable by URL. That is probably intended for the online stall, but it is a privacy decision that should be explicit. Do not put customer documents or expense receipt photos in a public bucket without a separate private bucket/policy.

### S11 — MEDIUM: stale hand-written database types

**Evidence**

- `src/types/database.types.ts` is a hand-written 388-line subset, not generated from the current schema.
- It does not include `payments`, `suppliers`, `purchases`, `activity_log`, `financial_accounts`, or `account_transactions`.
- It omits `deleted_at`, `features_enabled`, `is_sample`, `sku`, `quantity_unit`, etc. on some tables.

**Risk:** future TypeScript work will not see the real tables/columns; developers may re-declare or accidentally use stale shapes. Generate types from the linked project before Phase 1 schema work.

### S12 — LOW: no `created_by` on financial rows; `sales.sold_by` is unused

**Evidence**

- `sales.sold_by` exists (`20260928_01_core_and_modular_schema.sql` line 127) but no code writes it.
- `finance_entries`, `stock_movements`, `payments`, `budgets` have no `created_by`.
- `activity_log` exists but is unused.

**Risk:** Stage 2 staff attribution is harder; audit trail does not say who did what. The SPEC already requires `created_by` for future staff attribution.

### S13 — LOW: order number collision and unvalidated status/payment strings

**Evidence:** F19/F21.

**Risk:** support/reconciliation confusion; invalid states can be written directly.

---

## 4. Gaps vs SPEC.md for Stage 1

The following is a requirement-by-requirement gap list, not a wish list.

### 4.1 Phase 1a — Accounts, payments, credit sales

| SPEC requirement | Current state | Gap |
|---|---|---|
| `financial_accounts` with cash/bank/mtn_momo/airtel_money/other, opening balance, active flag | No table; no code | Missing entirely |
| Append-only `account_transactions` with signed amount, kind, source ref, `reversal_of`; balance = opening + sum | No table; no code | Missing entirely |
| `payments` table linked to account | Table exists from modular schema, but no app reads/writes it and it has no `account_id` | Needs extension, not a new table unless we choose to replace it |
| Auto-create Cash and MTN accounts for every vendor | Absent | Missing |
| `create_sale` supports fully paid, partial, unpaid, split; method → account | `create_sale` always `completed`, `paid_amount = total`; action hardcodes Cash | Missing |
| Record customer payment against balance | Absent; `customers.due_amount` never written | Missing |
| Transfers between accounts | Absent | Missing |
| Backfill existing data per section 6 | Absent | Missing |

### 4.2 Phase 1b — Stock integrity and costing

| SPEC requirement | Current state | Gap |
|---|---|---|
| Stock changes only through movement-writing functions | `updateProductAction` writes `stock` directly; no trigger/revoked privilege | Missing |
| Weighted-average cost per product | `restock_product` replaces cost; `create_sale` reads one cost | Missing |
| Sale lines snapshot `unit_cost` | Already correct | Keep |
| `record_purchase` replaces restock behaviour | Only `restock_product`; no `stock_purchases`/line items | Missing |
| Adjust stock / damage / loss / returns with reason | Only `adjustment` prompt via direct edit; no operations | Missing |
| Movement types initial/purchase/sale/sale_return/supplier_return/damage/loss/adjustment | Check allows only sale/restock/adjustment | Schema gap |
| Every movement has reason, `created_by`, source link | Only `reason`; no `created_by`, no source | Schema gap |
| Initial stock as `initial` movement with opening value | `record_initial_stock` writes `adjustment`, no value | Gap |
| Per-product `min_stock_alert` | Column exists, ignored | Gap |

### 4.3 Phase 1c — Expenses and reporting correctness

| SPEC requirement | Current state | Gap |
|---|---|---|
| Structured `kind` on money-out (`operating_expense`, `stock_purchase`, …) | No `kind`; exact category string | Missing |
| Category free label for reporting only | Category drives profit treatment | Wrong |
| Paid/unpaid/partial expenses, payment account | No payment status/account | Missing |
| Void/reverse instead of delete, audit log | Edits/deletes allowed; no `audit_logs` | Missing |
| Fix known inconsistencies list | Most still present (see section 2) | Mostly missing |
| Cash vs profit reconciliation test | No such test | Missing |

### 4.4 Screens / UX (SPEC section 5)

| Area | Current state | Gap |
|---|---|---|
| Navigation: Home · Sales · Stock · Money · More | TabBar is Home · Business · My Stall · Orders · Menu | Mismatch |
| Home cards: Money you have, Today’s sales, Today’s spending, Today’s profit, Customers owe you, Stock value | Home has Today’s Sales, Orders, Income, Expenses, Profit, New Customers | Missing money/stock/receivables cards; wrong “Income” label |
| Home period switcher: Today/Week/Month/Last month/Custom | Only 7d/30d/custom profit trend plus month dropdown | Incomplete |
| Home insights (max 3) | Absent; Analytics exists but no insight engine | Phase 3, not Stage 1 |
| Sale in ≤3 taps; defaults fully paid, last method, walk-in | Product → cart → record is close; but no payment method at sale, no last-method memory, no credit | Incomplete |
| Partial/credit/split one tap away | Absent | Missing |
| Success feedback: amount + account affected + receipt + undo/reverse | Amount + receipt only; no account, no undo | Missing |
| Receipt fields | Receipt has business, number, date, items, qty, prices, discount/savings, total, method; no balance due | Add paid/balance when credit exists |
| Never show cost/profit on customer receipt | Correct | Keep |
| Stock: View/Add/Restock plus initial/adjust/damage/loss/returns/history | View/Add/Restock only; edit form includes quantity; no history screen | Missing |
| Stock dashboard: products, units, stock value, low/out, best sellers, slow movers | Products/units/stock cost/expected only | Partial |
| Money: Accounts/Expenses/Other income/Budgets/Transactions | Expenses/Income/Budgets only; no accounts/transactions | Missing |
| Accounts create/rename/opening balance/balance/transfer/reconcile | Absent | Missing |
| Expenses: quick entry, category, date, account, supplier, note, paid/unpaid, receipt photo | Category/amount/date/note/frequency; no account/supplier/paid status/receipt | Partial |
| Other income must not double-count sales | It is a separate table, so structurally okay; no date | Partial |
| Budgets monthly per category using business month | Calendar month, no delete | Partial |
| One filterable transaction list (sales, payments, expenses, stock purchases, transfers, refunds, income, adjustments) | Only Home recent 40 sale/expense/income; no payments/transfers/refunds | Missing |
| Customers: name/phone/notes/total bought/paid/balance/history/record payment | Add/list/search only; no balance/history/payment | Missing |
| Suppliers: name/phone/products/history/owed/paid/balance | No supplier screen; table exists | Missing |
| Feature gating via `hasFeature` | `features_enabled` column exists but is unused; no `hasFeature` | Missing |
| Plain-language glossary | Some labels use “Expenses”, “Income”, “Gross profit”; no systematic glossary mapping | Partial |
| 360px low-end Android | Not tested in this audit; `MOBILE.md` and Capacitor exist | Unverified |

### 4.5 Security / integrity (SPEC section 8)

| Requirement | Current state | Gap |
|---|---|---|
| RLS on every table scoped by vendor | Present on all 25 tables | Keep; test more thoroughly |
| Never trust client for amounts/costs/ownership | Most writes are client-side; only sale/restock RPCs revalidate | Missing |
| `SECURITY DEFINER` asserts ownership and sets `search_path` | Existing definer functions do set `search_path`; `report_stock` legacy is dropped | Keep the rule; do not restore `report_stock` |
| `audit_logs` for voids/reversals, adjustments, opening balances, cost changes, settings | No `audit_logs`; `activity_log` unused | Missing |
| Concurrent sales lock products; stock never below zero | `create_sale` does `FOR UPDATE` and checks stock; direct edits bypass | Mostly correct for sales |
| Indexes for vendor_id + date, product_id, customer_id, account_id | Some exist; new account/payment tables need indexes | Partial |

### 4.6 Acceptance tests (SPEC section 10)

Current automated coverage is far below the 20 required tests.

| # | Acceptance test | Covered today? |
|---|---|---|
| 1 | Normal sale | Yes, partly (acceptance suite, if run) |
| 2 | Partial payment | No |
| 3 | Credit sale | No |
| 4 | Customer pays later | No |
| 5 | Stock purchase | Partly (only checks profit unchanged) |
| 6 | Weighted average | No (and current code would fail) |
| 7 | Sell part of stock | No |
| 8 | Operating expense | No |
| 9 | Transfer | No |
| 10 | Reconciliation identity | No |
| 11 | Duplicate submit | No |
| 12 | Concurrency | No |
| 13 | Refund/cancel | No |
| 14 | Product cost change | No |
| 15 | Void expense | No |
| 16 | Business-month boundary | Unit test only for the helper, not cross-screen |
| 17 | Date boundary | No |
| 18 | Stock integrity | No |
| 19 | RLS cross-vendor | Partly (products/sales only) |
| 20 | Migration before/after profit | No |

Also missing is a repeatable test harness for a staging/branch database. The current acceptance suite is destructive-ish (creates and deletes users) and requires a service-role key.

---

## 5. Proposed migrations

These are proposals only. Nothing below was applied. Every new table must have RLS scoped by `vendor_id`. Every `SECURITY DEFINER` function must assert vendor ownership and set `search_path`. Every migration must be tested on a staging copy and must have a rollback plan.

### M0 — Repository/migration hygiene (not a DB migration)

**Purpose:** remove `supabase/migrations/20260928_01_rollback.sql` from the migration folder and store it under `supabase/rollbacks/` (or delete it after preserving a copy). Add a documented “apply order” and a staging bootstrap.

**Destructive?** No production data change. It prevents a future destructive migration from running.

**Backfill:** none.

**Why first:** S7. A single `supabase db push` could otherwise drop sales/payments/customers.

**Status (2 Nov 2026):** done. The file is now `supabase/rollbacks/20260928_01_rollback.sql`; `supabase/migrations` no longer contains it. No SQL was applied.

### M1 — `financial_accounts` + cutover

**Purpose:** create per-vendor money accounts: `cash`, `bank`, `mtn_momo`, `airtel_money`, `other`; `opening_balance`, `is_active`, timestamps. Unique per vendor/type/name as appropriate. RLS: vendor-scoped SELECT/INSERT/UPDATE; every opening-balance change is audited.

**Destructive?** No. New table only.

**Backfill / cutover rules (decided 2 Nov 2026):**

- Define one **cutover date** (migration day). Account tracking begins at cutover. Historical `finance_entries` are **not** converted into account transactions; they remain profit-only history.
- For every existing vendor, auto-create `Cash` and `MTN Mobile Money` with `opening_balance = 0`.
- `Airtel Money`, `Bank`, and `Other` are created on first use, not auto-created.
- Opening balance must be `>= 0` at setup. Current balance may go negative later; warn, do not block.
- “Set your starting money” is a dismissible card on Home and Money, never a blocker. If skipped, 0 remains until set.
- For dates before cutover, cash-flow / “Money you have” shows **“not tracked”**, not zero and not a guessed balance.
- Every opening-balance change writes to `audit_logs`.

**Rollback:** drop the new table (only new data).

### M2 — `account_transactions` + extend `payments` + legacy sale backfill

**Purpose:** append-only signed money movements. `account_transactions(id, vendor_id, account_id, amount signed, kind, source_type, source_id, reversal_of, idempotency_key, created_by, created_at)`. Balance = `opening_balance + sum(amount)`. No UPDATE/DELETE policy; revoke UPDATE/DELETE. Add a unique `(vendor_id, idempotency_key)` where key is not null.

Extend the existing `payments` table (currently unused by the app) with `account_id`, `kind` (sale_payment/customer_payment/supplier_payment/expense_payment/refund), `idempotency_key`, `reversal_of`, `created_by`, `updated_at`, and `is_legacy boolean`. Keep existing columns for compatibility.

**Pre-flight (blocking):** query `select count(*) from public.payments` on the staging copy **before** altering it. If the count is non-zero, STOP and report before changing the table. Do not assume it is empty.

**Destructive?** No if `payments` is empty or only additive columns. If it has rows, the plan must be revised.

**Backfill (decided 2 Nov 2026 — this overrides the earlier audit proposal):**

- For every existing `sales` row, treat it as fully paid.
- Insert one `payments` row with `amount = sales.total`, `payment_date = sale_date`, `payment_method = sales.payment_method` (default Cash), `is_legacy = true`, and **no account link**.
- Do **not** insert `account_transactions` for legacy sales. Account tracking starts at cutover, so historical sales must not inflate the new account balances.
- Do **not** convert historical `finance_entries` expenses/income into `account_transactions`.
- Do **not** change `sales.total`, `profit`, `price_reduction`, or `sale_items` snapshots.
- Method mapping for future (non-legacy) payments: `Cash` → Cash; `MTN MoMo` → MTN; `Airtel Money` → Airtel; `Card` → Bank; `Other` → Other; null/unknown → Cash. If a Card sale is made and no Bank account exists, prompt to create one; do not block the sale, and fall back to Other if the vendor declines.
- Add a test comparing pre/post sales totals and profit for a sample of vendors.

**Rollback:** delete only rows created by this migration (identified by `is_legacy = true` / a migration batch flag), drop the new columns/table. Keep a backup.

### M3 — Sales payment/status/idempotency/rounding constraints

**Purpose:**

- Make sale status derived from payments; add `idempotency_key` unique per vendor, `created_by`, `cancelled_at`/`reversal_of` (or a separate reversal table), and check constraints on `status`/`payment_method`.
- Replace random `order_no` with a **per-vendor, per-day sequence** plus a unique constraint, e.g. `unique (vendor_id, sale_date, order_no)`. Generate in the DB under a lock, not in the browser.
- Reject `qty <= 0`, negative `cost`, and negative `sold_price` in the RPCs. Do not silently coerce invalid quantities to 1.
- Keep `paid_amount` and `status` only if the functions maintain them; add a test `paid_amount = sum(payments.amount)` for every sale.
- Round half-up, once, in the DB at write time. Do not rewrite historic rows. Add `CHECK (amount = round(amount)) NOT VALID` for new writes on money columns where appropriate; old rows are exempt because the constraint is `NOT VALID`. Do not change column types now.
- `unit_cost` keeps 2 decimals. Round line COGS (`unit_cost × qty`) to whole UGX at sale time. The UI never re-rounds stored values.

**Destructive?** Additive. Existing `status = completed` rows are updated to `paid`; no money values change. The `NOT VALID` check is added without scanning/rewriting old rows.

**Backfill:**

- Existing sales are fully paid via the legacy `payments` rows from M2, but they have **no** `account_transactions`. Set `status = 'paid'`, `due_amount = 0`, and `paid_amount = total` for rows that were `completed` (or derive from payments).
- Add `idempotency_key` as null for historical rows; unique indexes allow multiple nulls in Postgres.
- Do not rewrite `total`, `profit`, `price_reduction`, `sale_items`, or historic `unit_cost`.

**Rollback:** drop new columns/constraints; status update is reversible only if the old value is recorded (it was `completed`).

### M4 — Stock movements, weighted average, and movement-only stock

**Purpose:**

- Extend `stock_movements` with `reason` values `initial`, `purchase`, `sale`, `sale_return`, `supplier_return`, `damage`, `loss`, `adjustment`; add `source_type`, `source_id`, `unit_cost`, `value`, `note`, `created_by`, `reversal_of`.
- Add a DB trigger (or revoke column privilege) that blocks direct `products.stock`/`products.cost` updates except through approved functions. During the compatibility window, the trigger must allow old clients to continue until they are upgraded; see Milestone H.
- Implement `record_purchase` / updated restock with weighted average.
- Add adjust/damage/loss/return functions, each writing a movement.
- Product cost rules: Create Product accepts cost + initial quantity and writes an `initial` movement. Edit Product hides cost and quantity. Later changes go through Restock (weighted average), Adjust Stock (reason required), or Correct Cost (reason required, audited, affects future COGS only, never past sales).

**Destructive?** Additive columns/trigger. The trigger changes behaviour, so it must deploy with the code change that stops `updateProductAction` writing stock/cost. It is not destructive to data, but it can break old installed clients; plan the compatibility window.

**Backfill (decided 2 Nov 2026):**

- Never edit or delete old movements.
- Per product:
  - If the product has **no** movements, insert one `initial` movement at current `cost` and current `stock`.
  - If `stock != sum(movements.delta)`, insert **one** `adjustment` movement with reason text `legacy opening reconciliation` for the difference.
  - If `stock = sum(movements.delta)`, insert nothing.
- Opening cost = current `products.cost`; weighted-average starts there.
- Output a per-product mismatch report as part of the migration/verification run.
- Do not insert an opening row for products whose history already matches stock.
- Preserve all existing sale/restock/adjustment movements.

**Rollback:** drop new columns/functions/trigger; restore the old restock function. Existing movement rows remain.

### M5 — `finance_entries.kind`, account link, payment status, reversal/audit

**Purpose:**

- Add `kind` (`operating_expense`, `stock_purchase`, `other_income`, and later owner drawings etc.) with a check/enum.
- Add `account_id`, `payment_status` (`paid`/`unpaid`/`partial`), `supplier_id`, `idempotency_key`, `reversal_of`, `created_by`, `voided_at`/`reversed_by`.
- Change every aggregate to use `kind`, never `category`.
- Add `audit_logs` writes for edits/voids/cost changes/opening balances/settings.

**Destructive?** Additive columns + a data-classification update. No rows deleted.

**Backfill (decided 2 Nov 2026):**

- `type = 'expense'` and `trim(lower(category)) = 'stock purchase'` → `kind = 'stock_purchase'`, flagged `legacy_stock_purchase = true`.
- All other `type = 'expense'` → `kind = 'operating_expense'`.
- `type = 'income'` → `kind = 'other_income'`.
- Near-matches such as `Stock`, `Restock`, `stock purchase ` variants that are not the trim+case-insensitive exact phrase stay `operating_expense` (their historic treatment). Do **not** auto-classify them.
- Null/empty/unknown type or category → do **not** guess; insert a `migration_flags`/`audit_logs` row and leave `kind` null for manual review.
- Output a review report of near-matches and unclassifiable rows. The vendor can reclassify later with an `audit_logs` entry.
- Preserve historic profit: only the trim+case-insensitive exact `Stock purchase` phrase moves to `stock_purchase`; all other strings remain operating. The before/after net profit must therefore be identical. Test this on staging for a sample of real vendors.
- Add `kind` to future inserts in actions; stop using category strings in SQL.

**Rollback:** set `kind` back to null (or keep it; it is additive) and restore old RPCs. The classification update must be reversible with a recorded mapping.

### M6 — `stock_purchases` and purchase lines (future records only)

**Purpose:** a real stock-purchase record: supplier, date, qty, unit cost, total, paid/unpaid/partial, account, idempotency, `created_by`, `reversal_of`. It feeds inventory via `record_purchase`; it is **not** an operating expense.

**Destructive?** Additive.

**Backfill (decided 2 Nov 2026 — option (a)):**

- Existing `finance_entries` with `kind = stock_purchase` have no product/qty/supplier link. Do **not** invent one.
- Keep them as classified ledger entries and mark them `legacy_stock_purchase`.
- Do **not** create a `stock_purchases` header for a legacy expense.
- Do **not** create a stock movement for a legacy purchase; the stock is already represented in `products`/initial reconciliation.
- New purchases use the new table and `record_purchase` from Milestone D onward.

**Rollback:** drop new tables; legacy ledger entries remain.

### M7 — `audit_logs` and `created_by` across financial tables

**Purpose:** append-only audit for voids/reversals, stock adjustments, opening-balance changes, cost changes, settings changes. Store actor, timestamp, entity, before/after JSON, reason. Add `created_by` to `sales`, `finance_entries`, `stock_movements`, `payments`, `purchases`, `transfers`, `budgets` where appropriate.

**Destructive?** Additive.

**Backfill:** existing rows have no actor. Leave `created_by` null and flag “pre-audit” rather than pretending the owner did it. The vendor owner can be the default actor for future rows.

**Rollback:** drop new table/columns.

### M8 — Idempotency keys (if not folded into M2/M3/M5)

**Purpose:** one `idempotency_keys(vendor_id, key, operation, result jsonb, created_at)` table, unique `(vendor_id, key)`. RPCs check the key before writing and return the stored result on retry.

**Destructive?** Additive.

**Backfill:** none for existing rows; historical records remain without keys.

**Rollback:** drop new table.

### M9 — Reporting RPC replacement + indexes

**Purpose:** fix the reporting inconsistencies in one pass:

- Filter `deleted_at IS NULL` on expenses/income/products everywhere.
- Use `kind` instead of category strings.
- Use `product_id` in item stats (keep a name fallback only for legacy rows).
- Add one SQL source of truth, `business_month_range(vendor_id, date)`, and use it in Home, Analytics, Budgets, and Reports. The TypeScript helper must be parity-tested against it. Budgets reset on `month_start_day`.
- Pass the selected range into the category breakdown; add an upper bound.
- Use `min_stock_alert` for low stock.
- Price reductions: show **“Discounts given”** and **“Extra received above list price”** separately. Never net them. Use the same definition on Home and Analytics (decided 2 Nov 2026, option (c)).
- “Spent today” is all money paid out today, with a visible breakdown: “Running costs X · Stock bought Y”. The Profit card is labelled “after cost of products sold and running costs”.
- Add indexes: `finance_entries(vendor_id, entry_date, type, deleted_at)`, `sales(vendor_id, sale_date, deleted_at)`, `sale_items(product_id, sale_id)`, `stock_movements(vendor_id, product_id, created_at)`, `payments(vendor_id, sale_id, payment_date)`, `account_transactions(vendor_id, account_id, created_at)`, `customers(vendor_id, phone)`.

**Destructive?** `CREATE OR REPLACE FUNCTION` and `CREATE INDEX` only. No table data change. If a function signature changes, add a new overload and migrate callers before dropping the old one.

**Backfill:** none, but run before/after comparison tests on sample vendors (especially profit and sales totals).

### M10 — Transfers (can be part of M2)

**Purpose:** two linked `account_transactions` rows with `kind = transfer`, one negative and one positive, sharing a transfer group id. Not income, not expense.

**Destructive?** Additive.

**Backfill:** none; transfers did not exist historically.

**Rollback:** delete by transfer group id; drop helper if added.

### M11 — Refunds and cancellations

**Purpose:** partial or full refunds by line quantity, against an original sale, recorded on the **refund date**. The original sale is untouched. Refunds reverse revenue and COGS proportionally. Restock at the original `unit_cost` snapshot, or record a `damage` movement if the vendor chooses “damaged / don’t restock”. On unpaid/partial sales, reduce the amount owed first and pay cash out only for the remainder, from a chosen account. No customer store credit in Stage 1.

**Cancel:** full reversal for entry mistakes, reason required, and the sale drops out of reports on its original date. No exchanges. No refund without an original sale.

**Destructive?** Additive (new refund/reversal records); no mutation/deletion of the original sale.

**Backfill:** none; refunds did not exist historically.

**Rollback:** delete refund records created by this feature; the original sale remains.

### M12 — Feature gating defaults (no schema change required)

**Purpose:** introduce `hasFeature(vendor, key)` reading `vendors.features_enabled` now. Existing vendors: everything they currently use stays on. New vendors: Home/Sales/Stock/Money on; Customers, Suppliers, Budgets, extra accounts off until enabled or first needed. Stage 2/3 keys exist but are off, with no UI.

**Destructive?** No. Code + data defaults only.

**Backfill:** for existing vendors, merge the default-on keys into `features_enabled` without turning anything off.

**Rollback:** remove the helper/defaults; the JSON column remains.

### Migration safety rules for all of the above

1. Test on a Supabase branch/staging copy with representative vendor data.
2. Snapshot before/after: total sales, total profit, total expenses, stock value, per-vendor counts.
3. Never edit an applied migration; add a new one.
4. Make each migration idempotent where possible (`IF NOT EXISTS`, `CREATE OR REPLACE`, guarded DO blocks).
5. Document a rollback for every destructive/data-changing step.
6. Do not run `supabase/migrations/20260928_01_rollback.sql` on production.
7. Ensure every new table has RLS and every new RPC asserts `vendor_id` ownership with `SET search_path`.

---

## 6. Recommended implementation order (small milestones)

The answers in section 7 override `SPEC.md` where they conflict. Milestone A comes first. **No SQL migration is written or applied until the Milestone B plan (files, order, rollback, tests) is approved.** The order is chosen so each milestone is testable and does not leave money in an inconsistent state.

**Status (2 Nov 2026):** Milestone A in progress. M0 (rollback move), the lint-scope fix, the `hasFeature` helper/defaults, new-signup feature seeding, menu-level gating for Customers/Analytics, the production guard on acceptance tests, and the staging preflight script are done. The remaining items are blocked on the staging project/service key and on approval to add the failing acceptance suite. No schema/SQL behaviour was changed.

### Milestone A — Make verification real (no financial behaviour change)

1. Use **staging only** for acceptance tests. Confirm `akfktjvckvlfclkwjppn` is production (local evidence says yes) and create/point to a separate branch/project. *Blocked: waiting for staging ref/key.*
2. Obtain a dev-only `SUPABASE_SERVICE_ROLE_KEY` via environment variable (never committed, never production). *Blocked: waiting for key.*
3. Move `supabase/migrations/20260928_01_rollback.sql` out of `supabase/migrations` (M0) and document apply order. **Done.**
4. Snapshot current totals on the staging copy: sales, profit, expenses, stock value, row counts per table, and `public.payments` row count. *Blocked: needs staging.*
5. Add the missing acceptance tests as failing tests first (TDD): 2–20 from SPEC section 10. Do not run them against production. *Ready to start once staging is available.*
6. Fix the lint scope so `npm run lint` checks source, not Android build output. **Done.**
7. Introduce `hasFeature(vendor, key)` and the default flags (M12): existing vendors keep everything on; new vendors default to Home/Sales/Stock/Money on, Customers/Suppliers/Budgets/extra accounts off; Stage 2/3 keys off with no UI. **Done: `src/lib/features.ts`, new-signup seeding in `signUpAction`, and menu gating for Customers/Analytics. Money/Budgets/Accounts gating follows in the B/G milestones.**

**Exit:** current 19 acceptance checks pass **on staging**; new Stage 1 tests exist and fail for the expected reasons; production is untouched; `public.payments` count is known.

### Milestone B — Accounts, payments, and cutover (Phase 1a schema)

**Gate:** present the migration plan (files, order, rollback, tests) and wait for approval before writing SQL.

1. Pre-flight: query `public.payments` count on staging. If non-zero, STOP and report.
2. M1 `financial_accounts` + cutover date; auto-create Cash/MTN with opening 0; Airtel/Bank/Other on first use.
3. M2 `account_transactions` + extend `payments` + legacy sale backfill: one `payments` row per sale with `is_legacy = true`, **no account link**, **no account_transactions**.
4. M3 sale status/idempotency/order_no sequence/rounding constraints; `paid_amount = sum(payments)` test.
5. Add read-only Accounts and Transactions views. Before cutover, “Money you have” shows **“not tracked”**.
6. Tests: acceptance 1, 19, 20; legacy payments exist; no legacy account transactions; account balances start at opening 0; historic profit unchanged.

**Exit:** every existing sale has a legacy payment row; no legacy sale touches the new accounts; new accounts start at 0; no historic sales/profit changed; cross-vendor RLS still passes.

### Milestone C — Sale payment modes and customer payments (Phase 1a behaviour)

1. Refactor `create_sale` to accept full/partial/credit/split payments; write payments + account transactions in the same transaction; derive status; maintain `paid_amount` if kept.
2. **Customer link happens inside `create_sale`** in the same transaction. No post-sale customer link.
3. Derive customer totals/balances from sales and payments. Stop writing denormalised `total_spent` / `total_orders`.
4. Add “record customer payment” against a sale/customer; add transfers.
5. Update Sell screen: payment method at sale time, last-used method, credit/partial behind one tap, receipt shows paid + balance.
6. Add idempotency keys to sale/payment RPCs; per-vendor/per-day order-number sequence.
7. Tests: 2–4, 9, 11, 19.

**Exit:** a credit sale increases revenue but not cash; a later payment increases cash but not revenue; split payments hit the correct accounts; duplicate submit creates one record; customer balances are derived, not stored counters.

### Milestone D — Stock integrity and weighted average (Phase 1b)

1. M4 movement types/`created_by`/source + DB guard on `products.stock`/`cost` (with compatibility window; see Milestone H).
2. Implement `record_purchase` with weighted average; update restock UI.
3. Initial stock: `initial` when no movements; `legacy opening reconciliation` adjustment when stock ≠ sum(movements); per-product mismatch report; no opening row when history already matches.
4. Add adjust/damage/loss/customer return/supplier return, each with a reason and movement.
5. Stop `updateProductAction` writing stock/cost. Create Product accepts cost + initial qty; Edit Product hides cost and qty. Add Correct Cost (reason required, audited, future COGS only).
6. Tests: 5–7, 12, 14, 18.

**Exit:** stock value = Σ stock × weighted-average cost; a mixed-cost purchase produces the correct average; stock movements sum to `products.stock`; concurrent last-unit sales produce one success; mismatch report is empty or explained.

### Milestone D2 — Refunds and cancellations (after D, because it needs the new movement types)

1. M11 refunds by line quantity, against an original sale, recorded on the refund date; original sale untouched; revenue and COGS reversed proportionally.
2. Restock at the original `unit_cost` snapshot, or record a `damage` movement for “damaged / don’t restock”.
3. On unpaid/partial sales: reduce amount owed first; pay cash out only for the remainder from a chosen account.
4. Cancel = full reversal for entry mistakes, reason required, drops out of reports on the original date. No exchanges. No refund without an original sale. No customer store credit.
5. Tests: acceptance 13; audit entries for every refund/cancel; reports filter reversed rows consistently.

**Exit:** refund/cancel leaves the original sale and its snapshots untouched; cash, stock, revenue, and COGS reverse in the same transaction; history remains inspectable.

### Milestone E — Expenses, classification, void/reversal, audit (Phase 1c)

1. M5 `kind` + account/payment status + `reversal_of` + `created_by`.
2. M7 `audit_logs` and `created_by` backfill rules.
3. M6 `stock_purchases` for future records only; legacy `Stock purchase` entries stay ledger-only (option a).
4. Replace exact `'Stock purchase'` filters with `kind`; near-matches stay operating and go into a review report.
5. Add void/reverse actions; stop editing historical amounts/dates in place.
6. Tests: 8, 15; historic profit before/after.

**Exit:** custom/near-match category names cannot change profit treatment; editing history is impossible; voids are reversible and audited; stock purchases affect cash/stock but not operating profit.

### Milestone F — Reporting correctness (Phase 1c finish)

1. M9 reporting RPCs + indexes.
2. Add SQL `business_month_range(vendor_id, date)` as the single source of truth; parity-test the TS helper; use it in Home, Analytics, Budgets, and Reports. Budgets reset on `month_start_day`.
3. Fix item stats by `product_id`, range-bound category breakdown, `min_stock_alert`, deleted-row filters.
4. Price reductions: separate “Discounts given” and “Extra received above list price”; never net them; same definition on Home and Analytics.
5. “Spent today” = all money paid out today, with “Running costs X · Stock bought Y” breakdown; Profit is labelled as after cost of products sold and running costs.
6. Add the reconciliation identity test.
7. Tests: 10, 16, 17, 20.

**Exit:** the same period produces the same numbers on Home, Analytics, and Budgets; deleted rows never appear; discounts and premiums are separate; the reconciliation identity holds for the test period.

### Milestone G — Stage 1 UI (Phase 2)

1. Home cards and period switcher per SPEC; use the “not tracked” state before cutover.
2. Sales 3-tap flow, credit/partial/split, receipt paid/balance, success feedback with account + undo.
3. Stock operations/history/dashboard, per-product min stock, supplier fields.
4. Money: Accounts, Expenses, Other income, Budgets, Transactions.
5. Customers/Suppliers: balance, history, record payment; minimal supplier screen.
6. Navigation: Home · Sales · Stock · Money · More.
7. Feature gating UI on top of the `hasFeature` helper introduced in A; no scattered level checks.
8. Test at 360px on a low-end Android.

**Exit:** SPEC section 5 UX targets are met; no financial logic is duplicated in the UI; all money comes from SQL/loaders.

### Milestone H — Hardening and client-compatibility rollout (before Phase 3)

1. Full cross-vendor RLS matrix for every table and RPC.
2. Pagination for transactions/products/sales history.
3. Index review and query plans.
4. Offline is **not** in scope; show a clear “no connection” state and never silently lose a sale.
5. Stage 2/3 readiness check: `created_by`, append-only account transactions, movement history, reversal support, business-date helper.
6. **Client-compatibility rollout (amendment b):** never revoke direct `INSERT`/`UPDATE`/`DELETE` in the same release that introduces an RPC. Use three stages:
   - **Stage 1 — additive:** add RPCs and keep existing table grants. Both old and new clients work.
   - **Stage 2 — switch client:** ship the app using the RPCs in the same release that introduces each table's RPC. Keep grants for installed Capacitor/Android apps that still run old code. Monitor app version / client telemetry.
   - **Stage 3 — revoke:** after a compatibility window covering at least the supported app versions (define a minimum supported version and a date), revoke direct `INSERT`/`UPDATE`/`DELETE`, keeping `SELECT` for reads. Do this table by table, not all at once.
   - **Do not revoke yet.** For the stock guard, use a transaction-local bypass flag so old clients can still write until the cutoff, then remove the bypass.
   - If no app-version telemetry exists, add a version/build header before scheduling any revocation.

**Exit:** no known data-integrity or security gap in Stage 1; performance acceptable on real data volume; direct-DML revocation is scheduled only after old clients are out.

### Milestone B gate — what must be shown before any SQL

Before writing Milestone B SQL, provide:

1. Migration file names, order, and one-line purpose for each.
2. Exact schema changes, constraints, and RLS policies.
3. Backfill SQL outline for legacy payments and the cutover date.
4. Rollback for every file.
5. Test list mapped to acceptance tests 1/19/20 plus the `payments`-count preflight.
6. A staging run plan and the “STOP if `payments` is non-empty” checkpoint.

Nothing is applied until that plan is approved.

---

## 7. Decisions received (2 November 2026)

These answers override `SPEC.md` where they conflict and are now applied to sections 5 and 6.

| # | Decision |
|---|---|
| 1 | **No historical account backfill.** Use a cutover date (migration day). Old `finance_entries` stay profit-only history. Account tracking starts at cutover; the vendor sets opening balance as of that date. Before cutover, cash-flow / “Money you have” shows “not tracked”. |
| 2 | **Trust `sales.payment_method`.** Map Cash→Cash, MTN→MTN, Airtel→Airtel, Card→Bank, Other→Other, null/unknown→Cash. sales get a `payments` row (`is_legacy = true`, no account link) and **no** `account_transactions`. Cash + MTN auto-created; Airtel/Bank/Other on first use. |
| 3 | **Legacy Stock purchase = option (a).** `kind = stock_purchase`, flagged legacy, no `stock_purchases` header, no stock movement, no invented qty/supplier. Match = trim + case-insensitive exact phrase only. |
| 4 | **Initial stock.** Never edit old movements. Per product: if `stock != sum(movements)`, insert one `adjustment` “legacy opening reconciliation” for the difference; if no movements, insert one `initial`; if history already matches, insert nothing. Opening cost = current cost. Output a per-product mismatch report. |
| 5 | **Opening balances.** Must be `>= 0` at setup; current balance may go negative later (warn, don’t block). “Set your starting money” is a dismissible card on Home/Money, never a blocker. If skipped, 0 stays until set. Every opening-balance change is audited. |
| 6 | **Rounding.** Round half-up. Do not rewrite historic rows. New writes are whole UGX with `CHECK ... NOT VALID` so old rows are exempt. Do not change column types now. `unit_cost` keeps 2 decimals; round line COGS (`unit_cost × qty`) to whole UGX at sale time. UI never re-rounds. |
| 7 | **Refunds.** Partial or full, by line quantity, against an original sale, recorded on the refund date; original sale untouched. Reverse revenue and COGS proportionally. Restock at the original `unit_cost` snapshot or record a `damage` movement for “damaged / don’t restock”. On unpaid/partial sales: reduce amount owed first, pay cash out only for the remainder from a chosen account. No customer store credit. Cancel = full reversal for entry mistakes, reason required, drops out of reports on the original date. No exchanges; no refund without an original sale. |
| 8 | **Card → Bank.** If no Bank account exists when a card sale is made, prompt to create one; don’t block the sale, with Other as fallback. |
| 9 | **Product cost.** Create Product accepts cost + initial quantity (creates an `initial` movement). Edit Product hides cost and quantity. Changes go through Restock (weighted average), Adjust Stock (reason), or Correct Cost (reason, audited, affects future COGS only, never past sales). |
| 10 | **No auto-classification of custom categories.** Near-matches (e.g. `Stock`, `Restock`) stay `operating_expense` and go into a review report. Vendor reclassifies later with an audit log entry. |
| 11 | **`payments` table contents unknown.** Query the row count on the staging copy first. If non-empty, STOP and report before altering it. |
| 12 | **Staging.** A Supabase branch/project and a dev-only service key will be provided via env var. Never run acceptance tests against production. |
| 13 | **`hasFeature` now.** Use `vendors.features_enabled`. Existing vendors keep everything they currently use. New vendors: Home/Sales/Stock/Money on; Customers, Suppliers, Budgets, extra accounts off until enabled or first needed. Stage 2/3 keys exist but are off, with no UI. |
| 14 | **Business month.** Budgets reset on `month_start_day`. One SQL function `business_month_range` is the source of truth; the TS helper must be parity-tested against it. Home, Analytics, Budgets and Reports all use it. |
| 15 | **Price reductions = option (c).** Show “Discounts given” and “Extra received above list price” separately. Never net them. Same definition on Home and Analytics. |
| 16 | **“Spent today” = all money paid out today**, with a visible breakdown: “Running costs X · Stock bought Y”. The Profit card is labelled as after cost of products sold and running costs. |

### Is `akfktjvckvlfclkwjppn` production?

**Yes — treat it as production.** Local evidence:

- `.env.local` points at `https://akfktjvckvlfclkwjppn.supabase.co`.
- `supabase/.temp/linked-project.json` and `supabase/.temp/project-ref` are `akfktjvckvlfclkwjppn`.
- `README.md` line 134 calls `akfktjvckvlfclkwjppn` the “live project” with the full schema applied.
- `docs/ACCEPTANCE_REPORT.md` records the historical acceptance run against this same project.

Therefore acceptance tests must not run against it. A separate staging/branch project is required.

### Remaining blockers before Milestone B SQL

1. Staging/branch project ref and dev-only service key (via env var).
2. `select count(*) from public.payments` on staging (if non-zero, stop).
3. Confirmation of the cutover date to use for the migration.
4. Approval of the Milestone B migration plan (files, order, rollback, tests).

---

## Appendix A — Files inspected

**Docs:** `SPEC.md`, `FUTURE.md`, `docs/FINANCE_AND_STOCK_LOGIC.md`, `docs/DATABASE_BRIEFING.md`, `docs/ACCEPTANCE_REPORT.md`, `README.md`, `MOBILE.md`.

**Migrations:** all files in `supabase/migrations/`, plus `supabase/APPLY_ON_DASHBOARD.sql`.

**Actions:** `src/actions/business.ts`, `settings.ts`, `auth.ts`.

**Data/types:** `src/lib/data.ts`, `format.ts`, `product.ts`, `receipt.ts`, `constants.ts`, `auth.ts`, `supabase/browser.ts`, `supabase/server.ts`, `types/database.types.ts`, `types/app-db.ts`.

**Screens/components:** `HomeScreen.tsx`, `SellScreen.tsx`, `StockScreen.tsx`, `MoneyScreen.tsx`, `AnalyticsScreen.tsx`, `CustomersScreen.tsx`, `BusinessScreen.tsx`, `ProductSheet.tsx`, `VendorProvider.tsx`, `TabBar.tsx`; app pages under `src/app/(app)/`.

**Tests/scripts:** `scripts/unit-tests.ts`, `scripts/acceptance-tests.ts`, `scripts/preflight-staging.ts`, `package.json`.

**New Milestone A files:** `src/lib/features.ts` (feature gating), `scripts/preflight-staging.ts` (read-only staging preflight), `supabase/rollbacks/20260928_01_rollback.sql` (moved out of migrations).

## Appendix B — Commands run (exact)

```text
npm run test:unit          → exit 0, 21 passed
npm run test:acceptance    → exit 1, missing SUPABASE_SERVICE_ROLE_KEY (and refuses production when a key is present)
npx tsc --noEmit           → exit 0
npx eslint src scripts     → exit 0, 1 warning
npm run lint               → exit 0, 1 warning (after ignoring android/**; was 5901 problems before)
npm run build              → exit 0 (rerun after the feature-flag additions)
SUPABASE_SERVICE_ROLE_KEY=fake npm run test:acceptance → exit 1, production guard fired
SUPABASE_SERVICE_ROLE_KEY=fake npm run preflight:staging → exit 2, production guard fired
```

## Appendix C — Limitations of this audit

- I could not run the acceptance suite or inspect production data because `SUPABASE_SERVICE_ROLE_KEY` is absent. All statements about production data are therefore about the code/migrations, not a live database.
- RLS was reviewed statically; only the existing acceptance suite’s partial cross-vendor checks are evidence of runtime behaviour. I did not execute a full RLS matrix.
- I did not run a mobile/360px visual audit; `MOBILE.md` and Android assets exist, but this phase was an audit of finance/data logic.
- I did not modify or apply any migration. Proposed migrations are designs, not applied changes.

---

## Appendix D — Milestone B migration plan (proposed, not written)

This is the plan to approve before any SQL is created. It follows the decisions in section 7. It deliberately starts with `audit_logs` because M1 requires audited opening-balance changes.

### D.1 File order

| Order | Proposed file | Purpose | Destructive? |
|---|---|---|---|
| 1 | `20261102_00_audit_logs.sql` | Create append-only `audit_logs` (actor, action, entity, before/after, reason, timestamp), RLS, indexes. Needed by M1/M3/M4/M5. | No (new table) |
| 2 | `20261102_01_financial_accounts.sql` | Create `financial_accounts` (`kind`, `opening_balance`, `is_active`), RLS, constraints. Seed Cash + MTN for existing vendors at 0. | No (new table + new rows) |
| 3 | `20261102_02_payments_account_link.sql` | Extend existing `payments` with `account_id`, `kind`, `idempotency_key`, `reversal_of`, `created_by`, `updated_at`, `is_legacy`; indexes/FKs/checks. | Additive; **STOP if `payments` has rows** |
| 4 | `20261102_03_account_transactions.sql` | Create append-only `account_transactions` (signed amount, kind, source, reversal, idempotency, created_by); SELECT/INSERT only; revoke UPDATE/DELETE; indexes. | No (new table) |
| 5 | `20261102_04_sales_number_and_idempotency.sql` | Add `sales.idempotency_key`, `created_by`, status constraints; create per-vendor/per-day `sale_number_sequences` + `next_sale_order_no`; unique `(vendor_id, sale_date, order_no)`. | Additive + unique constraint |
| 6 | `20261102_05_legacy_sale_payments.sql` | Backfill one `payments` row per existing sale: `is_legacy = true`, `account_id = null`, no `account_transactions`. Idempotent (`not exists` guard). Set `status = paid`, `due_amount = 0`, `paid_amount = total` for previously `completed` sales. | Data insert/update; reversible with batch flag |
| 7 | `20261102_06_whole_ugx_checks.sql` | Add `CHECK (amount = round(amount)) NOT VALID` to new-write money columns (sales totals/profit/reduction, payment amount, account amount). `unit_cost` excluded (2 decimals). Do not change column types. | Additive `NOT VALID` constraints |
| 8 | `20261102_07_milestone_b_indexes.sql` | Indexes for accounts/payments/account_transactions/sales lookups and cutover queries. | No |
| — | `scripts/verify-milestone-b.ts` (not a migration) | Preflight and verification report. | No |

### D.2 Cutover rule

- `cutover_date = migration day` (exact date to be confirmed before writing SQL).
- Historical `finance_entries` are **not** copied to `account_transactions`.
- Historical sales get legacy `payments` rows but **no** account transactions.
- Account balance = `opening_balance + sum(account_transactions.amount)`; because there is no pre-cutover account history, balances start at opening balance and only include post-cutover activity.
- Before `cutover_date`, cash-flow / “Money you have” returns a “not tracked” state rather than 0.
- Opening balances must be `>= 0`; later balances may go negative (warn only).
- The “Set your starting money” card is dismissible and never blocks use.

### D.3 Backfill details

**Accounts**

- For every existing vendor: insert `Cash` and `MTN Mobile Money` with `opening_balance = 0`.
- Do not create Airtel/Bank/Other automatically; create on first use.
- Idempotent: `ON CONFLICT (vendor_id, ...) DO NOTHING`.

**Legacy sale payments**

- One row per `sales.id` where no legacy payment exists:
  - `amount = sales.total`
  - `payment_date = sales.sale_date`
  - `payment_method = sales.payment_method` (null/unknown → Cash)
  - `is_legacy = true`
  - `account_id = null`
- No `account_transactions` rows for legacy sales.
- Do not change `sales.total`, `profit`, `price_reduction`, `sale_items`, or historic `unit_cost`.
- Map only for future non-legacy payments: Cash→Cash, MTN→MTN, Airtel→Airtel, Card→Bank, Other→Other, null/unknown→Cash.

**Sales status**

- For existing `status = 'completed'` rows: set `status = 'paid'`, `due_amount = 0`, `paid_amount = total`.
- For any unexpected status: flag and leave for review; do not overwrite.
- Record the old value in `audit_logs`/migration flag so rollback is possible.

**Constraints**

- `payments.amount >= 0`.
- `account_transactions`: signed amount by kind (enforced in function/trigger, not a naive `>= 0`).
- `sales`: reject `qty <= 0`, negative `cost`, negative `sold_price` in RPCs (not only in constraints).
- Whole-UGX checks are `NOT VALID` so old decimal rows are exempt; new rows must be whole UGX.
- Do not change `numeric(14,2)` to integer now.

### D.4 Rollback plan (reverse order)

1. Drop Milestone B indexes.
2. Drop whole-UGX `NOT VALID` constraints.
3. Delete only legacy payments created by this migration (`is_legacy = true` + migration batch/source). Restore `status = 'completed'` where the migration changed it (using recorded before-values).
4. Drop `sale_number_sequences` + `next_sale_order_no`; drop new sales columns/constraints.
5. Drop `account_transactions`.
6. Drop new `payments` columns/FKs/checks.
7. Drop `financial_accounts`.
8. Drop `audit_logs`.
9. Verify row counts and totals return to the pre-migration snapshot.

No existing sale, expense, product, or stock row is deleted by this plan.

### D.5 Tests (staging only)

**Preflight**

- `select count(*) from public.payments`; if non-zero, STOP and report.
- Snapshot: per-vendor sales count/total/profit, expenses total, stock value, payments count.
- Confirm the database is staging, not production `akfktjvckvlfclkwjppn`.

**Schema/RLS**

- Vendor A can read/write its own accounts/payments/account_transactions.
- Vendor B cannot read or write vendor A's accounts/payments/account_transactions.
- `account_transactions` rejects UPDATE/DELETE for authenticated users.
- Every new table/RPC asserts vendor ownership and sets `search_path` where applicable.

**Backfill**

- Every existing sale has exactly one legacy payment.
- Every legacy payment has `is_legacy = true` and `account_id IS NULL`.
- No `account_transactions` row references a legacy sale.
- `sales.total`, `sales.profit`, and `sale_items` are byte-for-byte unchanged.
- `paid_amount = sum(payments.amount)` for every sale.
- Cash + MTN exist for every vendor with opening 0; Airtel/Bank/Other do not exist until first use.
- Cutover query: activity before cutover returns “not tracked”, not zero.
- Acceptance test 20 (before/after sales/profit) passes.

**New behaviour foundations**

- Same idempotency key twice creates one sale/payment and returns the original result.
- Two concurrent sales for the same vendor/day get distinct sequential order numbers.
- `qty <= 0`, negative cost, and negative sold price are rejected.
- A decimal amount on a new write is rejected/rounded half-up by the RPC, not stored as-is.
- `paid_amount` is maintained by the payment functions and matches the payment sum.

**Exit**

- 19/19 existing acceptance checks pass on staging.
- New Milestone B tests pass.
- No production data touched.
- Historic profit/sales totals unchanged.
- `payments` was empty (or the plan was stopped and revised).

---

**Phase 0 ends here.** No Phase 1 work has started; no Milestone B SQL has been written or applied.
