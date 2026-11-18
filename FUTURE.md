# FUTURE.md: Stage 2 and Stage 3 (DO NOT BUILD YET)

**Rule for the agent:** do not implement anything in this file. The only requirement is that Stage 1 decisions don't make these impossible later (e.g. don't hardcode "one user per vendor" in a way that can't be extended, keep `vendor_id` scoping consistent, keep money records append-only).

Features appear through the central capability check (`hasFeature`), never through scattered level checks. A business moves up a level without losing history.

---

## Stage 2: Intermediate (growing retail, staff, credit)

**Operations:** employee accounts, roles/permissions, salesperson tracking, staff activity history, multiple cashiers, shifts, cash reconciliation, returns/exchanges.

**Purchasing:** purchase orders, goods received, supplier invoices, supplier payments, supplier balances.

**Inventory:** product variants, barcodes, stock transfers, adjustments with approval, stocktaking, reorder suggestions, advanced costing.

**Finance:** receivable and payable ageing, recurring transactions that actually generate entries, approval workflows, detailed profit & loss, reconciliation.

**Reporting:** performance by employee/category, budget vs actual, cash-flow and sales forecasts, custom reports.

### What Stage 1 should keep ready
- Records carry `created_by` (user) so staff attribution can be added.
- Payments, purchases and sales are separate records linked by IDs (already planned).
- Audit log table exists and is used.

---

## Stage 3: Enterprise (multi-branch, finance team)

**Structure:** multiple branches, warehouses, branch-level stock/expenses/accounts, inter-branch transfers, consolidated reports, multi-company.

**Accounting:** double-entry, chart of accounts, journal entries, general ledger, trial balance, P&L, balance sheet, cash flow statement, period closing, reconciliation, audit controls. (Journals must be derived/consistent with the Stage 1 transaction tables; don't add parallel unreconciled tables.)

**Governance:** owner, admin, finance manager, accountant, branch/store manager, cashier, salesperson, auditor. Role- and permission-based access.

**Platform:** APIs, integrations, import/export, multi-currency, backup/recovery, advanced forecasting, approval workflows.

### What Stage 1 should keep ready
- `account_transactions` is append-only with source references, so it can later feed a ledger.
- Costing and movement history are authoritative, so warehouse/branch dimensions can be added to `stock_movements`.
- Reversals instead of deletes, so period closing is possible later.
- Business-date helper and `month_start_day` are centralized, so fiscal periods can be added later.
