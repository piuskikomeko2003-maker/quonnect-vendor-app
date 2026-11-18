# Business Modules, Navigation and Feature Visibility

This document maps the modules that sit around the core finance/stock flow: the Business hub,
Orders, Customers, Menu, Settings and the feature-flag layer. It explains where each feature is
surfaced and what data backs it.

For the money, stock and profit formulas, see [`FINANCE_AND_STOCK_LOGIC.md`](./FINANCE_AND_STOCK_LOGIC.md).

---

## 1. Navigation model

The bottom tab bar is the primary navigation:

| Tab | Route | Role |
|---|---|---|
| Home | `/home` | Daily snapshot, quick actions, profit trend, low stock |
| Business | `/business` | Money, analytics and customers in one hub |
| My Stall | `/stall` | Online listings, deals, stall appearance, customer preview |
| Orders | `/orders` | Sales history, booking/message placeholders |
| Menu | `/menu` | Account, business tools, support, logout |

The raised centre tab is **My Stall**, because it is the marketplace-facing action. Business is the
second tab and is deliberately treated as a hub rather than a single report.

### Sub-route highlighting

Some routes are reached directly but belong to a tab:

- Business tab stays active for `/business`, `/money`, `/analytics`, `/customers`, `/accounts` and
  `/settlements`.
- Menu tab stays active for `/menu`, `/settings`, `/notifications`, `/help` and `/profile`.

This avoids the “no tab selected” state when a vendor opens a deep link or legacy route.

---

## 2. Business accounts

`/accounts` is the management surface for the money a business holds. It is reached from the
Available Business Funds sheet on Home and from Menu → Business accounts.

- **Available Business Funds** is the sum of active account balances. It is not profit, stock
  value or unpaid invoices.
- **Balance = opening balance + every recorded account movement.** The balance is never stored or
  typed in directly, so it cannot drift from transaction history.
- Account types are Physical Cash, Bank Account, Mobile Money, Savings and Other. Multiple
  accounts of the same type are allowed (for example Main Cash Box, Shop Cash and Emergency
  Funds).
- Transactions are created by sales, expenses, other income and transfers. Transfers write two
  linked append-only movements and are neither income nor expense, so total funds stay the same.
- Deactivation only flips `is_active` after the derived balance is zero. The vendor must transfer
  the remaining money first; transaction history is kept and the account can be reactivated.
- At least one active cash, bank and mobile-money account is kept when those groups are in use, so
  sale payment-method mapping cannot fail.
- No bank, MTN, Airtel or other external financial API is required. Everything is manually
  recorded inside the app.

The data comes from `vendor_accounts_overview`; writes go through
`create_financial_account`, `update_financial_account`, `transfer_between_accounts` and
`set_financial_account_active`.

### Settlements

`/settlements` is the dedicated settlement section reached from Menu → Settlements. It keeps the
two money directions separate:

- **Customer collections** — money customers still owe. Each row shows the customer, total
  outstanding, number of unpaid/partial sales, oldest outstanding sale and most recent payment.
  Opening a customer lists the outstanding sales and allows a payment against one or several of
  them.
- **Supplier payments** — money the business still owes. Each row shows the supplier, total
  outstanding, number of unpaid purchases, oldest outstanding purchase and most recent payment.
  Opening a supplier lists the outstanding purchases and allows a payment against one or several
  of them.
- **Settlement history** — one filtered feed of both types by date, type, customer/supplier and
  business account.

A settlement pays an existing balance. Customer collections increase the receiving account and
reduce receivables without creating new sales revenue. Supplier payments reduce the paying account
and payables without recording the stock purchase expense again. Multiple outstanding items can be
settled together, and retries are idempotent.

The data comes from `vendor_settlements_overview`; writes go through `record_customer_payment` and
`record_supplier_payment`.

---

## 3. Business hub

`/business` combines three tabs:

| Tab | Data source | Notes |
|---|---|---|
| Income & expenses | `loadMoney()` + MoneyScreen | Expenses, other income, budgets |
| Analytics | `loadAnalytics()` + AnalyticsScreen | Embedded charts and controls |
| Customers | `loadCustomers()` + CustomersScreen | Only when the `customers` feature is on |

### Query parameters

| Key | Meaning |
|---|---|
| `tab=money` | Open the Money tab |
| `tab=analytics` | Open Analytics |
| `tab=customers` | Open Customers |
| `add=expense`, `add=income`, `add=budget` | Open the Money tab with the matching sheet |
| `range`, `group`, `metrics`, `months`, `cmp` | Analytics controls |

The Analytics controls are shared by `/analytics` and `/business` through
`src/lib/analytics-params.ts`. Changing a control inside the Business hub keeps `tab=analytics`
instead of jumping to the standalone Analytics route.

### Why a hub

The core record-keeping flow is still separated by job:

- **Sell** for recording transactions.
- **Stock** for inventory.
- **Business** for understanding the numbers.

The hub gives the vendor one place for money-in, money-out, trends and customers without adding
more bottom tabs.

---

## 4. Home dashboard

Home is the business overview. It starts with one shared reporting-period selector:
Daily (today, yesterday, any date), Weekly (this week, last week, custom range),
Monthly (this month, last month, any business month) and Custom (start and end dates).

Every period-based section uses the same selected range: summary cards, sales trend, profit
trend, expense breakdown, cash movement, product performance, transaction list and insights.
Available Business Funds, Customer Outstanding Balances and Stock Value are current figures and
do not change when the period changes.

Quick actions:

1. Record Sale → `/sell`
2. Add Expense → `/business?tab=money&add=expense`
3. Restock Inventory → `/stock`
4. Add Income → `/business?tab=money&add=income`
5. View Transactions → `/orders?tab=sales`

Available Business Funds is the most prominent card. Tapping it opens the individual active
business accounts and their current balances. It is the sum of active account balances, never
profit, stock value or unpaid invoices.

---

## 5. Orders

`/orders` has three tabs:

| Tab | State |
|---|---|
| Sales | Backed by the latest sale transactions from `vendor_recent_transactions` |
| Bookings | Empty state; bookings are not implemented |
| Messages | Empty state; messaging is not implemented |

The Sales tab is a read-only feed. Recording a sale still happens on `/sell`.

Product implication: do not present Bookings or Messages as live until there is a backing table
and write path. The empty states are honest placeholders.

---

## 6. Customers

`/customers` lists active (non-deleted) customers and their `total_orders` / `total_spent` totals.

Customers are created or updated in two ways:

1. Manually with “Add customer”.
2. Automatically when a sale includes a customer name or phone (`saveCustomerForSale`).

Customer totals are incremented when a sale is linked, not recalculated from sale history. A failed
customer link produces a warning but does not roll back the sale.

Feature visibility: the Customers tab and Menu link only appear when `hasFeature(vendor,
"customers")` is true. Existing vendors default to true; new signups start with optional features
off.

---

## 7. Menu and Settings

Menu groups:

- **Account** — profile, settings, notifications.
- **Business** — Business hub, online stall, record a sale, stock, income & expenses, business
  accounts, settlements, analytics, orders, customers.
- **Support** — help, logout.

Menu links deep-link into the Business hub where appropriate, so vendors do not bounce between
parallel screens.

Settings contains:

- **Profit month** start day (1–28). See the finance doc for its exact scope; it affects Home, not
  Analytics or budgets.
- Account/stall/notification shortcuts.
- Logout.

---

## 8. Feature flags

`src/lib/features.ts` defines three stages:

| Stage | Keys |
|---|---|
| Stage 1 core | `home`, `sales`, `stock`, `money` |
| Stage 1 optional | `customers`, `suppliers`, `budgets`, `accounts`, `analytics`, `insights` |
| Stage 2 | `staff`, `purchasing`, `advanced_inventory`, `advanced_reports` |
| Stage 3 | `branches`, `accounting`, `governance` |

Rules:

- Explicit flags in `vendors.features_enabled` win.
- Missing flags fall back to `EXISTING_VENDOR_FEATURES`, so older vendors do not lose working
  screens before the flag migration is backfilled.
- New signups receive `NEW_VENDOR_FEATURES` (core on, optional off).
- UI gates currently applied: Customers and Analytics in Menu and Business.
- Budgets are always available on the Money tab today; the `budgets` flag is reserved for a later
  gate.
- There is no in-app feature toggle yet. Enabling a feature today requires updating
  `vendors.features_enabled`.

Design rule: when adding a new screen, gate its navigation entry first, then gate the route. A
hidden feature must not leave dead links or empty tabs.

---

## 9. Current UX principles

1. **One hub per job.** Business is for understanding numbers; Sell and Stock are for doing the
   work.
2. **Deep links are explicit.** Prefer `/business?tab=analytics` over a parallel page when the
   context is “business performance”.
3. **No dead ends.** Empty Orders tabs explain what will appear later and link to the action that
   works today.
4. **Active tab always matches context.** Legacy routes highlight the owning tab.
5. **Feature flags are silent.** Disabled features are absent rather than shown as broken.
6. **Quick actions reflect current modules.** Placeholders were replaced with Customers, Business
   and Orders.

---

## 10. Known gaps

- Bookings and Messages are placeholders with no database tables or writes.
- Notifications are static tips, not persisted read/unread events.
- There is no feature-toggle UI; flags are data-only.
- Customers cannot be edited or deleted from the UI yet.
- Orders uses the latest 40 unified transactions and filters to sales; it is not paginated.
- Business analytics still loads when the `analytics` flag is off, but the tab is hidden.
- Home quick actions assume six items to fit the six-column desktop grid; keep the count at six or
  update `.quick-actions`.

---

## 11. File map

| Concern | File |
|---|---|
| Feature flags | `src/lib/features.ts` |
| Analytics URL parsing | `src/lib/analytics-params.ts` |
| Bottom tabs | `src/components/app/TabBar.tsx` |
| Business hub | `src/app/(app)/business/page.tsx`, `src/components/screens/BusinessScreen.tsx` |
| Business accounts | `src/app/(app)/accounts/page.tsx`, `src/components/screens/AccountsScreen.tsx` |
| Account writes | `src/actions/accounts.ts` |
| Account rules | `src/lib/accounts.ts` |
| Account schema/RPCs | `supabase/migrations/20261102_02_business_account_management.sql` |
| Stock purchase screen | `src/components/screens/RestockPurchaseSheet.tsx` |
| Stock purchase writes | `src/actions/purchases.ts` |
| Purchase rules | `src/lib/purchases.ts` |
| Purchase schema/RPCs | `supabase/migrations/20261102_03_stock_purchases.sql` |
| Settlements screen | `src/app/(app)/settlements/page.tsx`, `src/components/screens/SettlementsScreen.tsx` |
| Settlement writes | `src/actions/settlements.ts` |
| Settlement rules | `src/lib/settlements.ts` |
| Settlement schema/RPCs | `supabase/migrations/20261102_06_settlements.sql` |
| Orders | `src/app/(app)/orders/page.tsx`, `src/components/screens/OrdersScreen.tsx` |
| Customers | `src/app/(app)/customers/page.tsx`, `src/components/screens/CustomersScreen.tsx` |
| Menu | `src/app/(app)/menu/page.tsx` |
| Settings | `src/app/(app)/settings/page.tsx`, `src/components/screens/MonthRangeSettings.tsx` |
| Home actions | `src/components/screens/HomeScreen.tsx` |
| Preview fixtures | `src/app/preview/[screen]/page.tsx`, `src/lib/fixtures.ts` |
