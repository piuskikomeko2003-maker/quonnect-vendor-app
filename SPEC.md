# SPEC.md: Stage 1: Small Business Management System

Existing app: Next.js + Supabase, vendors in Uganda, currency UGX.
Goal: turn the current vendor finance app into a financially trustworthy, very simple business app that can later grow (see `FUTURE.md`) without a rebuild.

**Working principle:** simple on the surface, strict underneath. A vendor with no accounting knowledge should never see a word like "COGS" or "ledger" unless they open a detailed report.

---

## 1. Working rules (apply to every phase)

1. Inspect before changing. Don't rewrite working code. No new libraries without a stated reason.
2. One definition per number. No duplicate financial calculations in the UI and SQL. SQL/RPC is the source of truth; the UI only displays.
3. All schema changes go through Supabase migrations, each with a one-line purpose comment. Never edit applied migrations.
4. Never destructive on production data. Test migrations on a staging/branch DB first. Back up before any migration that alters or drops data.
5. Financial history is never silently rewritten. Corrections are reversals, not edits/deletes.
6. Every money operation: validated server-side, runs in one DB transaction, idempotent, auditable.
7. If a requirement is ambiguous and touches money: ask, don't guess.
8. After every change, run the test suite and show real output. A feature isn't "done" until implemented AND tested.
9. At the end of each milestone report: what you inspected, changed, files touched, migrations, tests added/passed/failed, known limitations, what's next. Then STOP for approval.

---

## 2. Design decisions already made (do not re-debate; flag only if you find a real blocker)

| Topic | Decision |
|---|---|
| Inventory costing | **Weighted-average cost** per product. On each purchase: `new_avg = (old_qty × old_avg + buy_qty × buy_cost) / (old_qty + buy_qty)`. Sale lines snapshot `unit_cost` at sale time. Past sales are never recalculated. `products.cost` = current average, changed only by purchase/adjustment functions, never by free-form edit. |
| Stock changes | `products.stock` may only change through DB functions that write a `stock_movements` row in the same transaction. Block direct updates (trigger or revoked column privilege). The product edit form must not write `stock`; stock corrections go through an "Adjust stock" action with a reason. |
| Movement types | initial, purchase, sale, sale_return, supplier_return, damage, loss, adjustment. Every movement has `reason`, `created_by`, and a link to its source (sale, purchase, etc.). |
| Money accounts | New `financial_accounts` (cash, bank, mtn_momo, airtel_money, other) with `opening_balance`, `is_active`. |
| Account balances | New append-only `account_transactions` (signed amount, kind, source ref, `reversal_of`). **Balance = opening_balance + sum(transactions).** No UPDATE/DELETE on this table. Corrections add a reversing row. |
| Transfers | Two linked `account_transactions` rows (kind = transfer). Not income, not expense. |
| Payments | Separate `payments` table (sale payments in, supplier/expense payments out), each linked to an account. A sale's status is **derived**: unpaid / partial / paid / cancelled / refunded. |
| Expense classification | Add a structured `kind` enum on money-out records (`operating_expense`, `stock_purchase`, ...). Category stays a free label for reporting only. **Never** decide accounting treatment from a category string. |
| Stock purchases | A `stock_purchases` record (supplier, qty, unit cost, payment status) feeds inventory. Paid portion reduces the chosen account. It is **not** an operating expense. |
| Corrections | No hard deletes of financial rows. Void/reverse with a reason + audit log entry. Reports filter reversed rows consistently, in ONE place. |
| Idempotency | Client-generated `idempotency_key`, unique per vendor, on sales, payments, expenses, purchases, transfers. Retry with the same key returns the original result. |
| Dates | One helper for "business date" (Africa/Kampala). `month_start_day` must apply to Home, Analytics, Budgets and Reports, everywhere or nowhere. |
| Rounding | UGX has no decimals. Round once, in the DB, at write time. The UI displays stored values and does not re-round separately. |
| Multi-business | Keep `vendor_id` for now. Don't rename or restructure to `business_id` in Stage 1, but write new tables so a later move to businesses/members is straightforward. All new tables get RLS scoped by `vendor_id`. |
| Feature gating | One central capability check (e.g. `hasFeature(vendor, 'suppliers')`). No scattered `if (level === ...)`. |

---

## 3. Financial concepts: never mix these

| Concept | Meaning | Source |
|---|---|---|
| Sales | Value of goods sold | `sales.total` |
| Cash received | Money actually collected | `payments` / `account_transactions` |
| Customers owe you | Sales total − payments received | derived |
| Cost of products sold (COGS) | `Σ unit_cost × qty` of sold lines | `sale_items` snapshots |
| Gross profit | Sales − COGS | derived |
| Running costs (operating expenses) | `kind = operating_expense`, by expense date | expenses |
| Other income | Non-sales income | income entries |
| Net profit | Gross profit + other income − running costs | derived |
| Stock value | `Σ stock × weighted-avg cost` | products |
| Money you have | Σ active account balances | accounts |
| Net cash flow | Cash in − cash out in the period (excludes transfers) | `account_transactions` |

Rules:
- Never label sales as "money received", or profit as "money you have".
- Profit and cash are separate calculations; they should reconcile via the identity: `Δcash + Δstock value + Δreceivables − Δpayables = net profit` (for periods without other adjustments). Use this as a test.
- Credit sales count toward sales and profit when sold, but toward cash only when paid.

---

## 4. Build order

Do not start a phase until the previous one is approved and its tests pass.

**Phase 0: Audit only.** Output `AUDIT.md`, no code changes.

**Phase 1a: Accounts, payments, credit sales**
- `financial_accounts`, `account_transactions`, `payments`, opening balances.
- Auto-create "Cash" and "MTN Mobile Money" accounts for every vendor (balance 0 until set).
- `create_sale` supports: fully paid, partial, unpaid (credit), split payments, payment method → account.
- Record customer payment against an existing balance.
- Transfers between accounts.
- Backfill existing data (section 6).

**Phase 1b: Stock integrity and costing**
- Enforce movement-only stock changes.
- Weighted-average costing via a `record_purchase` function (replaces the current restock behavior).
- Adjust stock / damage / loss / returns, each with a reason.
- Initial stock recorded as an `initial` movement with an inventory opening value.

**Phase 1c: Expenses and reporting correctness**
- `kind` classification, paid/unpaid/partial expenses, payment account.
- Void/reverse instead of delete, with audit log.
- Fix the reporting inconsistencies list below.
- Cash vs profit reconciliation test.

**Phase 2: Small-business UX** (screens in section 5)
**Phase 3: Reports + rule-based insights**
**Phase 4: Performance + offline**
**Phase 5: Review readiness for Stage 2/3** (only foundations that are genuinely required)

### Known inconsistencies to fix (from the current finance doc)
- Credit sales treated as fully paid.
- Stock purchase excluded from profit by exact string `"Stock purchase"`.
- Direct stock edit bypasses `stock_movements`.
- Item stats matched by product name, not `product_id`.
- `month_start_day` applies only to Home.
- Analytics category breakdown ignores selected range; item stats are all-time.
- Low-stock threshold hardcoded to 3; `min_stock_alert` ignored.
- Expense aggregates don't filter `deleted_at`; sales do.
- "Income" means different things on Home vs Money.
- `frequency: monthly` is a label that does nothing.
- UI rounding vs DB rounding can differ by 1 shilling.
- Sales above list price produce negative reductions that Home and Analytics treat differently.
- Budgets are calendar-month while Home uses business-month.
- Initial stock has no opening-balance representation.

---

## 5. Stage 1 screens and UX rules

### Hard UX targets
- A basic sale takes **3 taps or fewer**: pick item(s) → confirm → done. Defaults: fully paid, last-used payment method (Cash on first use), walk-in customer.
- Credit, partial and split payment are one tap away but never in the way of a normal sale.
- Works comfortably at **360px width on a low-end Android**. Test there first.
- No form has more than **5 required fields**. Everything else is optional or behind "More options".
- Show clear success feedback with amount + account affected + receipt/detail + a way to undo/reverse.
- Plain language everywhere (glossary below).

### Plain-language glossary (use these labels in the UI)
| Technical | Show |
|---|---|
| Receivables | Customers owe you |
| Payables | You owe suppliers |
| COGS | Cost of products sold |
| Operating expenses | Running costs |
| Net profit | Profit |
| Inventory value | Stock value |
| Net cash flow | Money in vs money out |
Technical terms may appear only inside detailed reports.

### Navigation
Home · Sales · Stock · Money · More (Customers, Suppliers, Reports, Insights, Settings). Bottom nav on mobile, sidebar on desktop.

### Progressive disclosure
New vendors see: Home, Sales, Stock, Money with Cash + MTN accounts pre-created. Customers, Suppliers, multiple accounts, budgets and advanced reports appear when the vendor turns them on (Settings → "Features") or first needs them (e.g. choosing "Credit" prompts adding a customer).

### Home
Question it answers: **"How is my business doing?"**
Cards: Money you have · Today's sales · Today's spending · Today's profit · Customers owe you · Stock value.
Period switcher: Today / This week / This month / Last month / Custom.
Trends (sales, profit, spending, money in vs out) with comparison to the previous equal period.
Insights (max 3 at top), each backed by real numbers.
Quick actions: Record Sale · Add Expense · Add Income · Add Product · Restock · Customer Payment.

### Sales
Product search, categories, images, quantity buttons, cart, custom price, discount, customer (optional), payment (full/partial/credit/split), receipt, history, refund/cancel. Receipt shows business name, number, date/time, items, qty, prices, discount, total, paid, balance due, method. **Never show cost or profit on the customer receipt.**

### Stock
Three tasks: **View · Add product · Restock.** Product fields: name, image, category, SKU (optional), cost, price, quantity, min stock level (per product, used for alerts), unit, supplier (optional), active. Dashboard: products, units, stock value, low/out of stock, best sellers, slow movers. Operations: initial stock, restock, adjust, damage, loss, customer return, supplier return, movement history.

### Money
Sections: Overview · Accounts · Expenses · Other income · Budgets · Transactions.
- Accounts: create/rename, opening balance, balance, money in/out, transfer, reconcile.
- Expenses: quick entry, category, date (default today), account, supplier, note, paid/unpaid, receipt photo (optional).
- Other income: must not double-count income already in sales.
- Budgets: monthly per category, using the configured business month.
- Transactions: one filterable list (sales, payments received, expenses, stock purchases, transfers, refunds, income, adjustments). Every row is inspectable, paginated.

### Customers / Suppliers
Keep minimal. Customer: name, phone, notes, total bought, total paid, balance, history, record payment. Supplier: name, phone, products supplied, purchase history, owed, paid, balance. No purchase orders in Stage 1.

---

## 6. Existing data and safety (critical, real vendors already use this)

Backfill rules for the migration:
- Existing sales → treated as **fully paid**, via the method already recorded (default Cash), with matching `payments` + `account_transactions` rows.
- Opening balance for every account = **0** until the vendor sets one. Show a one-time prompt: "Set your starting money so your balance is right."
- Existing stock → one `initial` movement per product at its current cost and quantity (weighted-average starts at current `cost`).
- Existing `Stock purchase` expenses → classified `kind = stock_purchase`. All other expenses → `operating_expense`. Existing income → `other_income`. Anything unclassifiable gets flagged, not guessed.
- Historic profit numbers must not change after the migration. Add a test comparing before/after totals for a sample of real vendors (on staging).
- Migrations must be reversible, or have a documented rollback plan, and idempotent where possible.

---

## 7. Insights (Phase 3)

Build in two layers first; add AI explanation only after the numbers are verified.

1. **Verified calculations**: SQL/deterministic only.
2. **Rule-based insights**, each showing the period and the figures:
   - Sales up but profit margin down.
   - Largest expense category this period.
   - Expenses growing faster than sales.
   - N products at/below their min stock level.
   - Customers owe UGX X (and who is overdue).
   - Slow-moving products with money tied up in stock.
   - Repeated budget overruns.
3. **Optional AI wording (later)**: AI receives only verified metrics + periods, may only rephrase them, must never invent numbers or write to the database, and must say so when data is incomplete.

Each insight: what's happening · relevant figures + period · what the owner can do · data-completeness note if needed.

---

## 8. Security and integrity

- RLS on every table, scoped by `vendor_id`; test cross-vendor access explicitly.
- Never trust the client for amounts, costs, or ownership. Server/RPC recalculates.
- `SECURITY DEFINER` functions must assert vendor ownership and set `search_path`.
- Audit log (`audit_logs`) for: voids/reversals, stock adjustments, account opening-balance changes, cost changes, settings changes. Store who, when, before/after.
- Concurrent sales must lock product rows; stock never goes below zero.
- Add DB indexes for the common filters (`vendor_id` + date, `product_id`, `customer_id`, `account_id`).

---

## 9. Performance and offline (Phase 4)

- Paginate transactions, products, sales history.
- Dashboard from aggregate queries / daily summary tables. Never load full history to render a card.
- Compress product images; lazy-load lists.
- **Offline is a separate project.** Don't claim it exists until built and tested: cached products, queued sales with idempotency keys, sync states (pending / synced / failed), conflict handling for stock. Until then, show a clear "no connection" state and never silently lose a sale.

---

## 10. Acceptance tests (UGX)

Automate these. Keep the existing acceptance tests passing.

1. **Normal sale:** cost 16,000, price 25,000, qty 1 → revenue 25,000, COGS 16,000, gross profit 9,000, stock −1, selected account +25,000 (if fully paid).
2. **Partial payment:** total 100,000, paid 60,000 via MTN → revenue 100,000, cash received 60,000, customer owes 40,000, MTN +60,000 only.
3. **Credit sale:** nothing paid → revenue counts, cash unchanged, customer owes the full amount.
4. **Customer pays later:** 40,000 paid → balance 0, account +40,000, revenue unchanged (not counted twice).
5. **Stock purchase:** 10 units @ 5,000, paid from Cash → stock value +50,000, Cash −50,000, operating expense unchanged, profit unchanged.
6. **Weighted average:** 10 @ 5,000 then 10 @ 7,000 → avg 6,000; stock value 120,000; earlier sales keep their old cost.
7. **Sell part of stock:** 3 @ 8,000, cost 5,000 → revenue 24,000, COGS 15,000, gross profit 9,000, 7 units left, stock value 35,000.
8. **Operating expense:** transport 2,000 from Cash → Cash −2,000, running costs +2,000, profit −2,000.
9. **Transfer:** 20,000 Cash → MTN → Cash −20,000, MTN +20,000, total unchanged, no income/expense.
10. **Reconciliation identity:** Δcash + Δstock value + Δreceivables − Δpayables = net profit for a test period.
11. **Duplicate submit:** same idempotency key twice → one record.
12. **Concurrency:** two simultaneous sales of the last unit → one succeeds, one rejected, stock = 0.
13. **Refund / cancel:** reverses stock, revenue, profit and account effects; history preserved.
14. **Product cost change:** old sales' COGS unchanged.
15. **Void expense:** removed from reports, remains in audit history.
16. **Business-month boundary:** `month_start_day = 25`; Home, Analytics, Budgets agree.
17. **Date boundary:** a sale at 23:59 and 00:01 Kampala lands on the correct days.
18. **Stock integrity:** `products.stock` always equals the sum of its `stock_movements`.
19. **RLS:** vendor A cannot read or write vendor B's data via any table or RPC.
20. **Migration:** historic profit/total sales before and after backfill are identical.
