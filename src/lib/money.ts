import type { BudgetProgress, MoneyOverview, MoneyTransaction } from "@/lib/types";

type SaleMoneyShape = {
  total: number | string | null;
  paid_amount: number | string | null;
  due_amount: number | string | null;
  status: string | null;
};

/**
 * The money actually received for a sale.
 *
 * Credit sales only add what was paid. Completed sales with no recorded
 * payment add the full total, which matches the database account-movement
 * trigger.
 */
export function saleReceivedAmount(sale: SaleMoneyShape): number {
  const total = Number(sale.total ?? 0) || 0;
  const paid = Number(sale.paid_amount ?? 0) || 0;
  const status = String(sale.status ?? "");

  if (status === "credit") return Math.max(0, paid);
  if (paid > 0) return Math.max(0, paid);
  if (status === "completed" || status === "paid") return Math.max(0, total);
  return Math.max(0, paid);
}

/** Money the customer still owes for this sale. */
export function saleOutstandingAmount(sale: SaleMoneyShape): number {
  const total = Number(sale.total ?? 0) || 0;
  const paid = Number(sale.paid_amount ?? 0) || 0;
  const due = Number(sale.due_amount ?? 0) || 0;
  return Math.max(0, due, total - paid);
}

export interface MoneyOverviewInput {
  availableFunds: number;
  salesReceivedThisMonth: number;
  otherIncomeThisMonth: number;
  expensesThisMonth: number;
  receivables: number;
  payables: number;
}

/**
 * Builds the six overview figures. Only money actually received counts toward
 * income and profit; unpaid invoices stay visible as receivables.
 */
export function buildMoneyOverview(input: MoneyOverviewInput): MoneyOverview {
  const salesReceived = Math.max(0, input.salesReceivedThisMonth);
  const otherIncome = Math.max(0, input.otherIncomeThisMonth);
  const received = salesReceived + otherIncome;
  const expenses = Math.max(0, input.expensesThisMonth);

  return {
    available_funds: input.availableFunds,
    received_this_month: received,
    sales_received_this_month: salesReceived,
    other_income_this_month: otherIncome,
    expenses_this_month: expenses,
    profit_this_month: received - expenses,
    receivables: Math.max(0, input.receivables),
    payables: Math.max(0, input.payables),
  };
}

/** Budget usage and health, used by the budgets list. */
export function budgetProgress(
  limitValue: number | string | null | undefined,
  spentValue: number | string | null | undefined,
): BudgetProgress {
  const limit = Number(limitValue ?? 0) || 0;
  const spent = Math.max(0, Number(spentValue ?? 0) || 0);
  const remaining = limit - spent;
  const percent = limit > 0 ? (spent / limit) * 100 : spent > 0 ? 100 : 0;

  return {
    limit,
    spent,
    remaining,
    percent,
    status: percent >= 100 ? "over" : percent >= 80 ? "close" : "ok",
  };
}

export interface MoneyTransactionFilters {
  search?: string;
  kind?: string;
  accountId?: string;
  category?: string;
  from?: string;
  to?: string;
}

/** Shared search/filter rule so the UI and tests agree on what matches. */
export function matchesMoneyTransaction(
  transaction: MoneyTransaction,
  filters: MoneyTransactionFilters,
): boolean {
  if (filters.kind && filters.kind !== "all" && transaction.kind !== filters.kind) {
    return false;
  }
  if (filters.accountId && filters.accountId !== "all" && transaction.account_id !== filters.accountId) {
    return false;
  }
  if (filters.category && filters.category !== "all" && transaction.category !== filters.category) {
    return false;
  }
  if (filters.from && transaction.date < filters.from) return false;
  if (filters.to && transaction.date > filters.to) return false;

  const search = filters.search?.trim().toLowerCase();
  if (!search) return true;

  return [transaction.title, transaction.category, transaction.account_name, transaction.note]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}
