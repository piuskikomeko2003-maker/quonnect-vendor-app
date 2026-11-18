# Finance, Stock and Profit Logic

This document describes **how the current app actually calculates money**, not how it is intended to work one day. It is derived from the SQL RPCs, server actions and screens in this repository as of 29 October 2026.

Source of truth, in order:

1. `supabase/migrations/20261021_01_ui_rebuild.sql` — sale, restock and aggregate RPCs.
2. `src/actions/business.ts` — write paths for products, sales, expenses, income and budgets.
3. `src/lib/data.ts` — read paths and client-side grouping.
4. `src/components/screens/HomeScreen.tsx`, `MoneyScreen.tsx`, `StockScreen.tsx`, `AnalyticsScreen.tsx` — where the numbers are combined for display.

If this document disagrees with those files, the files win.

Related: [`BUSINESS_MODULES_AND_NAVIGATION.md`](./BUSINESS_MODULES_AND_NAVIGATION.md) covers the Business hub, Orders, Customers, navigation and feature flags.

---

## 1. Mental model

The app has three separate streams that are joined only for reporting:

| Stream | Stored in | What it records |
|---|---|---|
| Sales | `sales` + `sale_items` | Revenue, cost of goods sold, gross profit and price reductions per sale |
| Other money movements | `finance_entries` | Expenses and other income (one flat ledger) |
| Inventory | `products` + `stock_movements` | Quantity, unit cost, selling price and quantity history |
| Money accounts | `financial_accounts` + `account_transactions` | Current business-account balances (Available Business Funds) |

There is no double-entry ledger. Profit is a derived number: it is recalculated from sales, sale-item cost snapshots and `finance_entries` every time a report is requested. Cash is separate: each active account balance is its opening balance plus the sum of its append-only account movements.

Two different things are both called “expenses” in the UI:

- **All expenses** — every `finance_entries` row with `type = 'expense'`, including `Stock purchase`. This is what the Money screen and the “Expenses” tiles show.
- **Operating expenses** — the same rows **excluding** the exact category `Stock purchase`. Only these reduce net profit, because stock cost is already deducted as cost of goods when an item sells.

That distinction is the most important rule in the system.

---

## 2. Tables involved

### `products`

One row per item. Relevant columns:

| Column | Meaning |
|---|---|
| `cost` | What the vendor paid per unit, in UGX |
| `price` | Listed selling price per unit, before discount |
| `discount_pct` | 0–90, used to derive the effective price |
| `stock` | Whole units on hand; never allowed below zero by the sale RPC |
| `is_active` | Published to the online stall. It does **not** control whether the item can be sold in the app |
| `category`, `sizes`, `colors`, `photo_urls` | Merchandising only |

### `stock_movements`

An audit trail of quantity changes: `delta` and `reason` (`sale`, `restock`, `adjustment`). It is written by the sale RPC, the restock RPC, and the product-creation trigger. It is **not** used to calculate stock value or profit; those read the current `products` row directly.

### `sales` and `sale_items`

`sales` stores the header: `total`, `profit`, `price_reduction`, `sale_date`, `status`, `paid_amount`, `payment_method`.

`sale_items` stores a snapshot at sale time:

- `listed_price` — effective listed price at that moment
- `sold_price` — what the customer actually paid per unit
- `unit_cost` — the product cost at that moment
- `quantity`, `total`, `profit`

Because cost and price are snapshotted, editing a product later does not rewrite historical profit.

### `finance_entries`

One flat ledger for both directions:

- `type = 'expense'` → expense
- `type = 'income'` → other income
- `amount`, `category`, `entry_date`, `notes`, `source`, `frequency`

`entry_date` is the business date. `created_at` is the audit timestamp. There are no separate `expenses` and `income` tables.

### `budgets`

`vendor_id`, `category`, `monthly_limit`, unique per `(vendor_id, category)`.

### `financial_accounts` and `account_transactions`

- Every vendor gets `Cash` and `MTN Mobile Money` accounts automatically.
- `account_transactions` is append-only. Balance = `opening_balance + SUM(amount)`.
- A sale adds only the amount actually received (`paid_amount`), so unpaid credit invoices never become available funds.
- Expenses are negative movements; other income is positive.
- Editing or deleting a finance entry writes a reversal plus a fresh movement rather than rewriting history.
- **Available Business Funds** = sum of active account balances. It is independent of the dashboard reporting period. Customer outstanding balances and stock value are shown separately and are never added to available funds.
- Manual accounts are managed at `/accounts`: create with an opening balance, edit name/type/description/colour/icon, transfer between accounts, and deactivate. Balances are never editable and are always `opening_balance + SUM(account_transactions.amount)`.
- A transfer writes two linked append-only movements (`kind = transfer`), so it changes neither income nor expenses and leaves total funds unchanged.
- Deactivation is only allowed when the derived balance is zero. The remaining money must be transferred first; account transaction history is retained and the account can be reactivated.
- A settlement writes exactly one account movement (`source_type = 'settlement_payment'`): positive for a customer collection and negative for a supplier payment. It never creates a sale, purchase, revenue or stock expense row.

### `settlement_payments` and `settlement_allocations`

- `settlement_payments` stores the settlement header: type, party, account, amount, method, reference, date and idempotency key.
- `settlement_allocations` applies one payment across one or more outstanding `sales` or `purchases`.
- Customer collections increase `sales.paid_amount`, reduce `sales.due_amount` and mark the sale paid when it reaches zero.
- Supplier payments increase `purchases.paid_amount` and reduce `purchases.due_amount`.
- A sale with settlement allocations is ignored by the sale account trigger, because the settlement itself wrote the ledger movement. This is what prevents double-counting.
- `(vendor_id, idempotency_key)` is unique, so a retried submit returns the original payment instead of moving money twice.

### `finance_categories`

Stores custom category names per vendor and type. Built-in category names live in `src/lib/constants.ts`.

---

## 3. Money conventions

- Currency is **UGX**.
- Database columns are `numeric(14, 2)`, so up to two decimals are supported.
- App entry flows round to whole shillings: product cost/price, expense amount, income amount and budget limit all use `Math.round`.
- Sale overrides can retain decimals because `sold_price` is accepted as numeric by the RPC; the UI displays rounded shillings.
- Display formatting is centralised in `src/lib/format.ts`: full form `UGX 1,234,500`, compact form `1.25M`.
- Business dates use **Africa/Kampala** for “today”, sale dates, restock expenses and the default month. Date keys inside the UI are handled as UTC dates to avoid browser timezone drift.

---

## 4. Products, prices and stock value

### 4.1 Effective selling price

```
effective_price = round(price × (1 − discount_pct / 100))
```

Implementation: `effectivePrice()` in `src/lib/product.ts`. The database computes its own `listed_price` snapshot with `ROUND(..., 2)` inside `create_sale`.

`discount_pct` is clamped to `0–90` when saved.

### 4.2 What the Stock screen totals mean

In `StockScreen.tsx`:

```
stock_cost      = Σ (cost × stock)
expected_revenue = Σ (effective_price × stock)
expected_profit  = expected_revenue − stock_cost
units_in_stock   = Σ stock
```

Labels in the UI:

- “Expected money if all stock sells” → `expected_revenue`
- “Expected profit” → `expected_revenue − stock_cost`
- “Stock cost” → `stock_cost`

These totals use the **current** `cost` and **current** discount. They are not based on the original purchase prices of the units currently on hand.

### 4.3 Restocking

`restock_product(p_vendor_id, p_product_id, p_qty, p_new_cost, p_create_expense)`:

1. Asserts the caller owns the vendor.
2. Locks the product row.
3. Adds `p_qty` to `stock`.
4. Sets `cost` to `p_new_cost` if supplied, otherwise keeps the existing cost.
5. Writes a `stock_movements` row with reason `restock`.
6. If `p_create_expense` is true, writes a `finance_entries` row:
   - `type = 'expense'`
   - `category = 'Stock purchase'`
   - `amount = p_qty × cost`
   - `entry_date = today` in Kampala

The optional expense is a **cash-out record**. It does not reduce profit, because the same cost will be deducted as COGS when the units sell.

### 4.3a Multi-product purchases and business accounts

The Stock screen now uses `record_stock_purchase` for restocking. It is one atomic transaction:

1. Validate every product and lock the product rows in a stable order.
2. Increase `products.stock` and write a `restock` row in `stock_movements` for each line.
3. Set each product's `cost` to the confirmed purchase cost.
4. Insert one `purchases` row and one `purchase_items` row per product.
5. Insert one `account_transactions` row for the amount **actually paid**, linked to
   `source_type = 'purchase'`. Credit and unpaid portions never move account money.
6. Store `due_amount = total_amount - paid_amount` as the supplier payable.

`purchases.supplier_name` is a free-text supplier label so a payable can be recorded without a
separate supplier setup. `vendor_purchases_overview` groups unpaid amounts by supplier.

The client sends an `idempotency_key`. `purchases` has a unique
`(vendor_id, idempotency_key)` partial index, so a retried save returns the original purchase
instead of increasing stock or reducing the account a second time.

Transfers remain separate: `transfer_between_accounts` writes two linked `kind = transfer`
movements and does not create income, expense or purchase rows.

### 4.3b Settlements do not repeat revenue or expense

Settlements live on `/settlements` and have two deliberately separate flows:

- **Customer collection** — validates the outstanding sale balance, records the payment, increases
  `sales.paid_amount`, reduces the customer receivable and increases the receiving account. No
  `sales` row is created, so revenue and profit are unchanged.
- **Supplier payment** — validates the outstanding purchase balance, records the payment, increases
  `purchases.paid_amount`, reduces the supplier payable and reduces the paying account. No
  `purchases` row or `Stock purchase` expense is created, so stock and COGS are unchanged.

Both flows accept a partial amount or several outstanding items in one payment. Allocation rows
record exactly which sale or purchase each part of the payment settled.

### 4.4 Initial stock

Registering a product with an initial quantity writes an `adjustment` movement via the `record_initial_stock` trigger. It does **not** create a `Stock purchase` expense.

Consequence: stock that existed before the vendor started using the app has a cost basis for future profit, but no corresponding cash-out entry in the ledger.

### 4.5 No inventory layering

There is no FIFO, LIFO or weighted-average costing. The product has one `cost` field:

- Changing cost during restock revalues **all** units currently in stock.
- Future sales use the new cost for every unit.
- Past `sale_items` keep their old `unit_cost`, so historical profit is unchanged.

### 4.6 Low-stock rules

- Home low-stock list: `stock <= 3`, limited to 12 products, sorted lowest first.
- Stock list badge: red at `stock <= 0`, amber at `stock <= 3`.
- The `min_stock_alert` column exists but is **not used** by the current UI.

### 4.7 Editing stock directly

`updateProductAction` writes the `stock` field directly to the value typed in the product sheet. This change:

- does **not** write a `stock_movements` row;
- does **not** create a stock-purchase expense;
- is a full replacement of the quantity, not a delta.

The restock path is the controlled path. Direct product editing is the escape hatch and can make `stock_movements` disagree with `products.stock`.

---

## 5. Recording a sale

### 5.1 Cart and price override

The Sell screen adds products to a cart. The default sold price is the effective price, but the vendor can type any positive sold price. The screen warns when the sold price is below the listed price or below cost, but it does **not** block the sale.

At submit time, `recordSaleAction` sends only:

```json
{ "product_id": "...", "qty": 1, "sold_price": 25000 }
```

The database, not the browser, controls the financial calculation.

### 5.2 `create_sale` transaction

Inside one transaction:

1. Assert vendor ownership.
2. Reject an empty cart.
3. Generate an order number: `S-YYMMDD-NNNN`.
4. Insert the `sales` header with today’s Kampala date and status `completed`.
5. For each line:
   - Lock the product row `FOR UPDATE`.
   - Reject the line if the product does not belong to the vendor.
   - Reject the line if `stock < qty`.
   - Recompute `listed_price = ROUND(price × (1 − discount_pct/100), 2)`.
   - Read `sold_price` (defaults to listed if omitted).
   - Read `unit_cost = product.cost`.
   - Accumulate totals.
   - Decrement stock.
   - Write a `stock_movements` row with `delta = −qty`, reason `sale`.
   - Insert a `sale_items` row with listed, sold and cost snapshots.
6. Update the sale header with `total`, `subtotal`, `paid_amount`, `profit`, `price_reduction`.

Any failure rolls back the whole sale, including stock changes.

### 5.3 Sale formulas

For each line:

```
line_total        = sold_price × qty
line_profit       = (sold_price − unit_cost) × qty
line_reduction    = (listed_price − sold_price) × qty
```

For the sale:

```
total            = Σ line_total
profit           = Σ line_profit
price_reduction  = Σ line_reduction
```

`price_reduction` is positive when the vendor discounts and negative when the vendor sells above the listed price.

### 5.4 Canonical example (also in the acceptance tests)

Product: listed price 27,000, cost 16,000. Sell 1 unit for 25,000.

```
total           = 25,000
profit          = 25,000 − 16,000 = 9,000
price_reduction = 27,000 − 25,000 = 2,000
stock           = decreases by 1
```

### 5.5 Payment and status

- `recordSaleAction` always creates the sale with payment method `Cash`.
- The receipt screen can later change the method to Cash, MTN MoMo, Airtel Money or Card.
- `paid_amount` is set equal to the sale total, and `due_amount` stays 0.
- Profit queries do **not** filter on `sales.status` or `paid_amount`; if a sale row exists and is not soft-deleted, its revenue and profit count. The current UI never creates credit or cancelled sales.
- Customer linking happens as follow-up writes after the sale transaction. If it fails, the sale still exists and the action returns a warning.

---

## 6. Expenses, other income and budgets

### 6.1 Expense entry

`addExpenseAction`:

- requires a category and an amount > 0;
- rounds the amount to whole UGX;
- stores `type = 'expense'`;
- stores `source = 'manual'`;
- accepts an `entry_date`, but any future date silently becomes today;
- stores `frequency` as `daily` or `monthly`.

### 6.2 What `frequency` actually does

**It is a label only.** It does not create recurring entries, amortise a monthly cost over days, or change any profit calculation.

A monthly expense is recorded once on its `entry_date` and counts fully in that month. Selecting “Monthly” simply tags the row in the Money screen.

### 6.3 Categories

Built-in expense categories:

`Stock purchase`, `Transport`, `Stall fee`, `Packaging`, `Airtime/Data`, `Food`, `Other`

Built-in income categories:

`Tailoring`, `Repairs`, `Delivery`, `Commission`, `Gift`, `Other`

Custom categories are saved to `finance_categories` when an expense, income or budget uses a name outside the built-in list. Category names are trimmed, collapsed and limited to 40 characters.

The exclusion from operating costs is an **exact string comparison** with `Stock purchase`. A custom category such as `stock purchase` or `Stock` will reduce net profit like any other operating expense.

### 6.4 Other income

`addIncomeAction`:

- stores `type = 'income'`;
- always uses today as `entry_date` (there is no date picker for income);
- requires amount > 0;
- rounds to whole UGX.

“Other income” is separate from sales. Sales are recorded automatically through `sales`; income entries are for things like tailoring, repairs, delivery or commission.

### 6.5 Budgets

`setBudgetAction` upserts one limit per expense category:

```
UNIQUE (vendor_id, category)
```

Budget progress is:

```
budget_spent = Σ expenses in budgeted categories in the current calendar month
budget_total = Σ monthly_limit for all budgets
budget_pct   = budget_spent / budget_total × 100
```

- Over 100% shows “Over budget”.
- Over 80% shows “Almost at limit”.
- There is no delete-budget action; setting a new limit updates the existing row.
- Budgets are calendar-month based, even if the vendor changes the profit-month start day.
- Stock purchases count against a budget if the vendor creates a `Stock purchase` budget; they still do not reduce net profit.

### 6.6 Restock expenses

When restocking with “Also record as stock-purchase expense” checked:

```
expense = qty × new_cost
```

This row appears in:

- the Money list;
- total expenses;
- expense-category breakdowns;
- budget spend if budgeted.

It is excluded from:

- operating expenses;
- net profit;
- net-profit trends.

---

## 7. Profit definitions

### 7.1 Core formulas

```
gross_profit        = Σ sale.profit
                    = Σ ((sold_price − unit_cost) × qty)

cogs                = Σ (unit_cost × qty)
                    = total_sales − gross_profit

operating_expenses  = Σ finance_entries.amount
                      where type = 'expense'
                        and category <> 'Stock purchase'

other_income        = Σ finance_entries.amount
                      where type = 'income'

total_expenses      = Σ finance_entries.amount where type = 'expense'

net_profit          = gross_profit + other_income − operating_expenses
```

`vendor_daily_series` and `vendor_monthly_series` implement these formulas directly.

### 7.2 Why stock purchases are excluded from net profit

If stock purchases reduced profit **and** cost of goods also reduced profit, the same money would be counted twice:

1. once when the vendor buys the stock;
2. again when the stock sells.

The app uses an accrual-style profit view:

- buying stock changes cash and inventory;
- selling stock releases cost of goods;
- gross profit is revenue minus that released cost;
- operating expenses are then deducted.

### 7.3 Profit is not cash

The system does not calculate a cash balance. Sales may be unpaid in principle, purchases may be unpaid in principle, and no bank/cash account exists. The numbers are an operating-profit view, not a cash-flow statement.

For a period with no opening stock and no credit, the accounting identity is:

```
change in cash + change in inventory value = net profit
```

Worked example:

```
Restock 10 units at 5,000              → cash −50,000, stock +50,000
Sell 3 units at 8,000                  → cash +24,000
Cost of the 3 units at 5,000           → COGS 15,000, gross profit 9,000
Transport expense                      → cash −2,000, operating expense 2,000
Remaining stock: 7 units × 5,000       → closing inventory 35,000

Net profit = 9,000 − 2,000 = 7,000
Cash change = 24,000 − 50,000 − 2,000 = −28,000
Inventory change = 35,000
−28,000 + 35,000 = 7,000 ✓
```

Note that “total expenses” in this example is 52,000, while only 2,000 is deducted in net profit. Both are correct for their different purposes.

### 7.4 Margins and growth

- Home profit margin = `net_profit / sales × 100` for the selected Home window.
- Home growth = percentage change in net profit versus the same number of elapsed days in the previous business month.
- Analytics sales growth = percentage change in sales versus the immediately preceding window of equal length.
- If the comparison value is zero, the percentage is suppressed or shown as “New”; percentages are capped at `999%+`.
- `pctChange` uses the absolute value of the previous number, so negative baselines still produce a sensible direction.

### 7.5 Price reductions

- `sales.price_reduction` stores net reduction at sale time.
- Home’s monthly “Price reductions given” sums only `GREATEST(price_reduction, 0)` per sale, so premiums do not cancel discounts.
- Analytics “Price cuts given” is `expected revenue − actual revenue` across the monthly series, so it is a net figure and can theoretically be reduced by sales above list.
- Daily `expected_revenue = sales + price_reduction`. With a negative reduction, expected revenue can be lower than actual revenue.

---

## 8. Profit over time

### 8.1 Daily series

`vendor_daily_series(vendor, from, to)` returns one row per day in the range, including zero days.

Each row contains:

| Field | Formula |
|---|---|
| `sales` | Σ sales total for that date |
| `gross_profit` | Σ sales profit |
| `price_reduction` | Σ sales price reduction |
| `expected_revenue` | sales + price reduction |
| `expenses` | all expense entries, including stock purchases |
| `operating_expenses` | expenses excluding `Stock purchase` |
| `other_income` | income entries |
| `net_profit` | gross profit + other income − operating expenses |

Sales are filtered by `deleted_at IS NULL`. Expense rows are not filtered by `deleted_at` in this function.

### 8.2 Monthly series

`vendor_monthly_series(vendor, months)` returns zero-filled calendar months, clamped to 1–24 months. It adds `cogs`:

```
cogs = sales − gross_profit
```

The current month is included and is still in progress.

These are **calendar months**. They do not use the vendor’s profit-month start day.

### 8.3 The “profit month” setting

`vendors.month_start_day` is 1–28, set in Settings → Profit month.

It is used by the Home screen to:

- choose the default month key when a business month does not align with the calendar month;
- calculate the “Monthly profit” card and its month-on-month arrow;
- calculate the “Monthly overview” window for the selected month;
- decide the previous comparison window using the same number of elapsed days.

Example with `month_start_day = 25`:

- 23 October belongs to the business month starting 25 September.
- 25 October belongs to the business month starting 25 October.
- A business month runs from the 25th to the 24th of the next calendar month.

Important scope limit: the setting currently affects **Home only**. `vendor_monthly_series`, Analytics range boundaries, expense-category month windows and budgets all remain calendar-month based.

There are also unused server fields in `vendor_home_overview`: `month`, `net_month` and `net_prev_month` are calculated but the current Home screen derives its monthly figures from the daily series instead.

### 8.4 Analytics ranges and grouping

Analytics supports 7 days, 30 days, 90 days, 6 months and 12 months.

- 7/30/90-day ranges start a fixed number of days back from today.
- 6- and 12-month ranges start at the first day of the calendar month N months ago.
- Grouping can be day, week or month, subject to the range.
- Weekly buckets start on Monday (`weekStartKey`).
- Buckets are filled from `start` to `end`, so empty periods become zero points rather than gaps.

Totals on the Analytics screen are sums of the daily series for the selected range:

```
sales   = Σ daily.sales
expenses = Σ daily.expenses        (includes stock purchases)
profit   = Σ daily.net_profit      (excludes stock purchases)
```

The “Profit” line and totals therefore use net profit, not gross profit.

### 8.5 Period comparisons

`loadAnalytics` also fetches the immediately preceding range of the same length:

```
previousStart = start − rangeLength
previousEnd   = start − 1 day
```

Only **sales growth** uses this previous window. The expenses and profit cards do not show a previous-period comparison.

### 8.6 Expense category breakdown

The “Where the money went” list is not tied to the selected chart range. It loads expense totals from the first day of the month `months − 1` months ago, where `months` is the 6/12 month selector. With the 12-month option, it is a rolling 12-calendar-month expense breakdown.

### 8.7 Cost vs expected vs actual

- “Over time” uses the monthly series: COGS, expected revenue, actual revenue.
- “By item” uses `vendor_item_stats`, which is **all-time**, not range-limited, and returns the top 8 products by units sold.
- Item stats match sold rows to products by `product_name`, not `product_id`. Duplicate or renamed product names can merge or misalign the comparison.
- If an item has never sold, expected is the current effective price and actual is 0.

---

## 9. What each screen shows

### Home

| Element | Calculation |
|---|---|
| Today’s Sales | Σ sales today, Kampala date |
| Orders | Count of sale rows today |
| Income | Sales today **plus** other income today (not other income alone) |
| Expenses | All expenses today, including stock purchases |
| Profit | Net profit today |
| New Customers | Distinct phone (or lowercase name) on today’s sales |
| Monthly profit card | Business-month net profit from daily series; previous window uses elapsed days |
| Business performance chart | Sales, sales + other income, and all expenses |
| Profit margin | Net profit ÷ sales for the selected Home window |
| Growth vs last month | Net-profit change vs same elapsed days last business month |
| Best-selling product | All-time top item by units sold from `vendor_item_stats` |
| Profit trend | Daily net profit for 7 days, 30 days or a custom range (max 60 days) |
| Daily Profits | Net profit today |
| Monthly overview | Sales, gross profit, positive price reductions, other income, all expenses, net profit for the selected business-month window |
| Budget used | Current calendar month’s spend in budgeted categories ÷ total budgets |
| Low stock | Products with `stock <= 3` |
| Recent sales | Unified sale/expense/income feed, latest 40 |

### Sell

- Shows all products returned by `loadSell`, not only published ones.
- Blocks adding more than current stock.
- Prevents a zero or negative sold price.
- Warns, but does not block, when sold price is below listed or below cost.
- Receipt displays listed vs sold price and sale profit.

### Stock

- Totals as defined in section 4.2.
- Category filters include built-in and custom product categories.
- Register/edit product controls name, category, sizes, colours, cost, price, quantity, discount and publish state.
- Restock is the controlled quantity path.
- No supplier, purchase order or stock-transfer flow is wired into this screen.

### Money

- **Expenses**: last 50 expense rows, latest by `created_at`, with daily/monthly tag and edit.
- **Income**: last 100 income rows.
- **Budgets**: per-category limit, spend and progress bar.
- Expense editing can change category, amount, date, note and frequency.
- There is no delete action for expenses, income or budgets in the current UI.

### Analytics

- Business growth line chart, monthly sales, expense trend, category breakdown, and cost/expected/actual comparison.
- Monthly charts are calendar months.
- “Current month is still in progress.”

---

## 10. Edge cases and known limitations

These are behaviours worth knowing before changing the code or explaining the numbers to a vendor.

1. **Profit-month scope is partial.** `month_start_day` changes Home’s monthly card, Home’s selected month window and the default Home month. It does not change Analytics months, expense-category windows or budgets.
2. **Direct stock edits bypass the audit trail.** Editing quantity in the product sheet changes `products.stock` without a `stock_movements` row or stock-purchase expense.
3. **One cost per product, no layers.** Restocking at a new cost revalues all current stock and all future COGS. Historical sale items keep their old cost.
4. **Stock purchases affect two different reports differently.** They appear in total expenses and budgets but are excluded from net profit.
5. **The exclusion is string-exact.** Only the category named exactly `Stock purchase` is treated as non-operating.
6. **Expense frequency is cosmetic.** “Monthly” does not create a recurring charge or prorate anything.
7. **Credit sales would count as profit.** Profit queries do not filter `sales.status` or use `paid_amount`; the current UI only creates completed, fully paid sales.
8. **Sales above list price create negative reductions.** Home ignores them in the “Price reductions given” line; Analytics nets them against discounts.
9. **Item comparison is all-time and name-matched.** “Cost vs expected vs actual” is not limited to the selected range and can merge products with the same name.
10. **Low-stock threshold is hardcoded.** `min_stock_alert` exists but is ignored; the UI thresholds are `<= 3` and `<= 0`.
11. **Soft deletes are applied unevenly.** Sales queries filter `deleted_at`; expense aggregates and `loadProducts` do not. There is no UI soft-delete path, so this mainly matters for manual database edits.
12. **Home “Income” is total inflow.** The tile adds sales and other income, while the Money screen uses “income” to mean non-sales income only.
13. **Home monthly card and server month summary can diverge.** The card uses a business-month window from the daily series; `vendor_home_overview` computes a calendar-month summary that the Home screen currently does not render.
14. **Budget windows are calendar months.** A vendor with a 25th-starting profit month still sees budgets reset on the 1st.
15. **There is no cash balance or opening balance.** The app cannot answer “how much money is in the till?”; it answers “what profit did the recorded activity produce?”
16. **Initial stock has no purchase entry.** Registering existing stock creates cost basis for COGS but not a cash-out row.
17. **Customer linking is not atomic with the sale.** A sale can succeed while the customer link fails; the action surfaces a warning.
18. **Rounding can differ by a shilling.** UI effective price rounds to whole UGX, while `create_sale` snapshots `listed_price` to two decimals.
19. **Unpublished products are still sellable in the app.** `is_active` controls the online stall listing; `loadSell` loads all vendor products.
20. **The legacy `report_stock` RPC is removed.** The migration drops it because it allowed a caller with a null viewer id to read stock as the owner. Current stock totals are computed in the browser from loaded products.

---

## 11. Where the logic lives

| Concern | File / function |
|---|---|
| Effective price | `src/lib/product.ts` → `effectivePrice` |
| Money and date formatting, business month key | `src/lib/format.ts` |
| Create/update product | `src/actions/business.ts` → `createProductAction`, `updateProductAction` |
| Restock | `src/actions/business.ts` → `restockProductAction`; SQL `restock_product` |
| Record sale | `src/actions/business.ts` → `recordSaleAction`; SQL `create_sale` |
| Expenses, income, budgets | `src/actions/business.ts` → `addExpenseAction`, `updateExpenseAction`, `addIncomeAction`, `setBudgetAction` |
| Profit-month setting | `src/actions/settings.ts` → `updateMonthStartDayAction`; UI `MonthRangeSettings.tsx` |
| Daily/monthly aggregates | SQL `vendor_daily_series`, `vendor_monthly_series` in `20261021_01_ui_rebuild.sql` |
| Home overview | SQL `vendor_home_overview`; fallback shape in `src/lib/data.ts` |
| Unified transaction feed | SQL `vendor_recent_transactions` |
| Expense category totals | SQL `vendor_expense_categories` |
| Item comparison | SQL `vendor_item_stats` |
| Data loading and grouping | `src/lib/data.ts` → `loadHome`, `loadMoney`, `loadAnalytics`, `groupMetrics` |
| Home business-month maths | `src/components/screens/HomeScreen.tsx` → `businessMonthStart`, `selectedWindow`, `monthlyProfit` |
| Stock totals | `src/components/screens/StockScreen.tsx` → `totals` |
| Analytics presentation | `src/components/screens/AnalyticsScreen.tsx` |

---

## 12. Invariants worth preserving

These are covered by `scripts/acceptance-tests.ts` and `scripts/unit-tests.ts`:

- A sale decrements stock atomically and never goes negative.
- A sale stores listed, sold and cost snapshots on each line.
- Sale profit = `(sold − cost) × qty`.
- Price reduction = `(listed − sold) × qty`.
- Creating a `Stock purchase` expense does not change net profit.
- A day with operating expenses above gross profit produces negative net profit.
- Changing the selected month changes the monthly figures.
- A discount produces the expected effective price.
- A business month follows the configured start day.
- Vendors cannot read, write or sell another vendor’s data.
