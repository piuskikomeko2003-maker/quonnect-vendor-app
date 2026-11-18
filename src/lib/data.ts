import type { SupabaseClient } from "@supabase/supabase-js";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants";
import { totalAvailableFunds } from "@/lib/accounts";
import {
  buildMoneyOverview,
  saleOutstandingAmount,
  saleReceivedAmount,
} from "@/lib/money";
import type { AppDatabase } from "@/types/app-db";
import {
  addDays,
  currentMonthKey,
  dayMonthLabel,
  monthShort,
  monthStartKey,
  monthsAgoKey,
  todayKey,
  weekStartKey,
} from "@/lib/format";
import type {
  AccountMovement,
  AccountSummary,
  AccountsData,
  AnalyticsData,
  CashMetric,
  DailyMetric,
  DashboardAccount,
  DashboardData,
  DashboardPeriodTotals,
  ExpenseCategoryStat,
  GroupedSeries,
  HomeData,
  HomeOverview,
  ItemStat,
  LowStockProduct,
  MoneyData,
  MoneyTransaction,
  MonthlyMetric,
  PurchaseItemSummary,
  PurchasesData,
  CustomerCollectionSummary,
  OutstandingCustomerSale,
  OutstandingSupplierPurchase,
  SellData,
  SettlementAllocationSummary,
  SettlementHistoryEntry,
  SettlementsData,
  StockPurchaseRecord,
  SupplierPayable,
  SupplierPayableSummary,
  Transaction,
} from "@/lib/types";
import type { Budget, Customer, FinanceEntry, Product, Sale, SaleItem } from "@/types/app-db";

/** Name kept for compatibility; these loaders now run against the browser client. */
export type ServerClient = SupabaseClient<AppDatabase>;

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export async function loadHome(
  supabase: ServerClient,
  vendorId: string,
  month: string,
  from: string,
  to: string,
): Promise<HomeData> {
  const today = todayKey();
  const yesterday = addDays(today, -1);

  const [overviewResult, dailyResult, transactionsResult, salesResult, itemsResult] =
    await Promise.all([
      supabase.rpc("vendor_home_overview", { p_vendor_id: vendorId, p_month: month }),
      supabase.rpc("vendor_daily_series", { p_vendor_id: vendorId, p_from: from, p_to: to }),
      supabase.rpc("vendor_recent_transactions", { p_vendor_id: vendorId, p_limit: 40 }),
      supabase
        .from("sales")
        .select("sale_date, customer_name, customer_phone")
        .eq("vendor_id", vendorId)
        .gte("sale_date", yesterday),
      supabase.rpc("vendor_item_stats", { p_vendor_id: vendorId }),
    ]);

  const daily = asArray<DailyMetric>(dailyResult.data);
  const salesRows = (salesResult.data ?? []) as {
    sale_date: string;
    customer_name: string | null;
    customer_phone: string | null;
  }[];

  const rowsOn = (day: string) => salesRows.filter((row) => row.sale_date === day);
  const customersOn = (day: string) =>
    new Set(
      rowsOn(day)
        .map((row) => row.customer_phone?.trim() || row.customer_name?.trim().toLowerCase() || "")
        .filter(Boolean),
    ).size;
  const incomeOn = (day: string) => {
    const row = daily.find((item) => item.day === day);
    return row ? Number(row.sales) + Number(row.other_income) : 0;
  };

  return {
    overview: (overviewResult.data as unknown as HomeOverview) ?? {
      today,
      selected_month: month,
      sales_today: 0,
      sales_yesterday: 0,
      net_today: 0,
      net_yesterday: 0,
      expenses_today: 0,
      expenses_yesterday: 0,
      net_month: 0,
      net_prev_month: 0,
      month: {
        sales: 0,
        gross_profit: 0,
        price_reduction: 0,
        other_income: 0,
        expenses: 0,
        net_profit: 0,
      },
      budget: { spent: 0, total: 0 },
      low_stock: [],
    },
    daily,
    transactions: asArray<Transaction>(transactionsResult.data),
    extras: {
      orders_today: rowsOn(today).length,
      orders_yesterday: rowsOn(yesterday).length,
      customers_today: customersOn(today),
      customers_yesterday: customersOn(yesterday),
      income_today: incomeOn(today),
      income_yesterday: incomeOn(yesterday),
      top_items: asArray<ItemStat>(itemsResult.data),
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function number(value: unknown): number {
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The dashboard RPC returns one JSON document so every period-based section
 * comes from the same snapshot. Normalise it because numeric values can arrive
 * as strings from PostgREST.
 */
export function normalizeDashboard(value: unknown): DashboardData {
  const root = record(value);
  const period = record(root.period);
  const current = record(root.current);

  const periodTotals: DashboardPeriodTotals = {
    from: text(period.from),
    to: text(period.to),
    sales: number(period.sales),
    gross_profit: number(period.gross_profit),
    price_reduction: number(period.price_reduction),
    other_income: number(period.other_income),
    expenses: number(period.expenses),
    operating_expenses: number(period.operating_expenses),
    net_profit: number(period.net_profit),
    orders: number(period.orders),
    customers: number(period.customers),
  };

  const daily = asArray<Record<string, unknown>>(root.daily).map<DailyMetric>((row) => ({
    day: text(row.day),
    sales: number(row.sales),
    gross_profit: number(row.gross_profit),
    price_reduction: number(row.price_reduction),
    expected_revenue: number(row.expected_revenue),
    expenses: number(row.expenses),
    operating_expenses: number(row.operating_expenses),
    other_income: number(row.other_income),
    net_profit: number(row.net_profit),
  }));

  const cash = asArray<Record<string, unknown>>(root.cash).map<CashMetric>((row) => ({
    day: text(row.day),
    cash_in: number(row.cash_in),
    cash_out: number(row.cash_out),
  }));

  const categories = asArray<Record<string, unknown>>(root.categories).map<ExpenseCategoryStat>(
    (row) => ({ category: text(row.category), total: number(row.total) }),
  );

  const items = asArray<Record<string, unknown>>(root.items).map<ItemStat>((row) => ({
    name: text(row.name),
    cost: number(row.cost),
    expected: number(row.expected),
    actual: number(row.actual),
    sold: number(row.sold),
  }));

  const accounts = asArray<Record<string, unknown>>(current.accounts).map<DashboardAccount>(
    (row) => ({
      id: text(row.id),
      name: text(row.name),
      kind: text(row.kind),
      opening_balance: number(row.opening_balance),
      balance: number(row.balance),
      is_active: row.is_active !== false,
    }),
  );

  return {
    period: periodTotals,
    daily,
    cash,
    categories,
    items,
    transactions: asArray<Transaction>(root.transactions),
    current: {
      available_funds: number(current.available_funds),
      customer_outstanding: number(current.customer_outstanding),
      stock_value: number(current.stock_value),
      stock_units: number(current.stock_units),
      accounts,
    },
    low_stock: asArray<LowStockProduct>(root.low_stock),
  };
}

export async function loadDashboard(
  supabase: ServerClient,
  vendorId: string,
  from: string,
  to: string,
): Promise<DashboardData> {
  const { data, error } = await supabase.rpc("vendor_dashboard", {
    p_vendor_id: vendorId,
    p_from: from,
    p_to: to,
  });

  if (error) {
    if (error.code === "PGRST202" || /vendor_dashboard/i.test(error.message)) {
      throw new Error(
        "The dashboard database functions are not installed yet. Apply the latest database migration and reload.",
      );
    }
    throw new Error(error.message);
  }

  return normalizeDashboard(data);
}

export function normalizeAccountsOverview(value: unknown): AccountsData {
  const root = record(value);

  const accounts = asArray<Record<string, unknown>>(root.accounts).map<AccountSummary>((row) => ({
    id: text(row.id),
    name: text(row.name),
    kind: text(row.kind),
    opening_balance: number(row.opening_balance),
    description: text(row.description) || null,
    color: text(row.color) || null,
    icon: text(row.icon) || null,
    balance: number(row.balance),
    is_active: row.is_active !== false,
    movement_count: number(row.movement_count),
    last_activity: text(row.last_activity) || null,
  }));

  const transactions = asArray<Record<string, unknown>>(root.transactions).map<AccountMovement>(
    (row) => ({
      id: text(row.id),
      account_id: text(row.account_id),
      account_name: text(row.account_name),
      amount: number(row.amount),
      kind: text(row.kind),
      source_type: text(row.source_type) || null,
      source_id: text(row.source_id) || null,
      occurred_on: text(row.occurred_on),
      notes: text(row.notes) || null,
      created_at: text(row.created_at),
    }),
  );

  return { accounts, transactions };
}

export async function loadAccounts(
  supabase: ServerClient,
  vendorId: string,
): Promise<AccountsData> {
  const { data, error } = await supabase.rpc("vendor_accounts_overview", {
    p_vendor_id: vendorId,
    p_transaction_limit: 300,
  });

  if (error) {
    if (error.code === "PGRST202" || /vendor_accounts_overview/i.test(error.message)) {
      throw new Error(
        "The business account database functions are not installed yet. Apply the latest database migration and reload.",
      );
    }
    throw new Error(error.message);
  }

  return normalizeAccountsOverview(data);
}

export function normalizePurchasesOverview(value: unknown): PurchasesData {
  const root = record(value);

  const purchases = asArray<Record<string, unknown>>(root.purchases).map<StockPurchaseRecord>(
    (row) => ({
      id: text(row.id),
      reference_no: text(row.reference_no) || null,
      supplier_name: text(row.supplier_name) || null,
      account_id: text(row.account_id) || null,
      account_name: text(row.account_name) || null,
      purchase_date: text(row.purchase_date),
      total_amount: number(row.total_amount),
      paid_amount: number(row.paid_amount),
      due_amount: number(row.due_amount),
      notes: text(row.notes) || null,
      created_at: text(row.created_at),
      items: asArray<Record<string, unknown>>(row.items).map<PurchaseItemSummary>((item) => ({
        product_id: text(item.product_id) || null,
        product_name: text(item.product_name) || null,
        quantity: number(item.quantity),
        unit_cost: number(item.unit_cost),
        total_cost: number(item.total_cost),
      })),
    }),
  );

  const supplierPayables = asArray<Record<string, unknown>>(root.supplier_payables).map<SupplierPayable>(
    (row) => ({
      supplier_name: text(row.supplier_name) || "Unspecified supplier",
      due_amount: number(row.due_amount),
      purchase_count: number(row.purchase_count),
      last_purchase_date: text(row.last_purchase_date) || null,
    }),
  );

  return {
    purchases,
    supplierPayables,
    outstanding: number(root.outstanding),
  };
}

export async function loadPurchases(
  supabase: ServerClient,
  vendorId: string,
): Promise<PurchasesData> {
  const { data, error } = await supabase.rpc("vendor_purchases_overview", {
    p_vendor_id: vendorId,
    p_limit: 25,
  });

  if (error) {
    if (error.code === "PGRST202" || /vendor_purchases_overview/i.test(error.message)) {
      throw new Error(
        "The stock purchase database functions are not installed yet. Apply the latest database migration and reload.",
      );
    }
    throw new Error(error.message);
  }

  return normalizePurchasesOverview(data);
}

export function normalizeSettlementsOverview(
  value: unknown,
  accounts: AccountSummary[] = [],
): SettlementsData {
  const root = record(value);

  const customerCollections = asArray<Record<string, unknown>>(root.customer_collections).map<CustomerCollectionSummary>(
    (row) => ({
      customer_key: text(row.customer_key),
      customer_id: text(row.customer_id) || null,
      customer_name: text(row.customer_name) || "Walk-in customer",
      customer_phone: text(row.customer_phone) || null,
      outstanding: number(row.outstanding),
      sale_count: number(row.sale_count),
      oldest_sale_date: text(row.oldest_sale_date) || null,
      last_payment_date: text(row.last_payment_date) || null,
    }),
  );

  const customerSales = asArray<Record<string, unknown>>(root.customer_sales).map<OutstandingCustomerSale>(
    (row) => ({
      id: text(row.id),
      order_no: text(row.order_no) || null,
      customer_id: text(row.customer_id) || null,
      customer_key: text(row.customer_key),
      customer_name: text(row.customer_name) || "Walk-in customer",
      customer_phone: text(row.customer_phone) || null,
      sale_date: text(row.sale_date),
      total: number(row.total),
      paid_amount: number(row.paid_amount),
      due_amount: number(row.due_amount),
      status: text(row.status) || "credit",
    }),
  );

  const supplierPayables = asArray<Record<string, unknown>>(root.supplier_payables).map<SupplierPayableSummary>(
    (row) => ({
      supplier_key: text(row.supplier_key),
      supplier_name: text(row.supplier_name) || "Unspecified supplier",
      outstanding: number(row.outstanding),
      purchase_count: number(row.purchase_count),
      oldest_purchase_date: text(row.oldest_purchase_date) || null,
      last_payment_date: text(row.last_payment_date) || null,
    }),
  );

  const supplierPurchases = asArray<Record<string, unknown>>(root.supplier_purchases).map<OutstandingSupplierPurchase>(
    (row) => ({
      id: text(row.id),
      reference_no: text(row.reference_no) || null,
      supplier_key: text(row.supplier_key),
      supplier_name: text(row.supplier_name) || "Unspecified supplier",
      purchase_date: text(row.purchase_date),
      total_amount: number(row.total_amount),
      paid_amount: number(row.paid_amount),
      due_amount: number(row.due_amount),
      notes: text(row.notes) || null,
    }),
  );

  const history = asArray<Record<string, unknown>>(root.history).map<SettlementHistoryEntry>((row) => ({
    id: text(row.id),
    settlement_type:
      text(row.settlement_type) === "supplier_payment"
        ? "supplier_payment"
        : "customer_collection",
    customer_id: text(row.customer_id) || null,
    party_name: text(row.party_name) || "Unknown",
    amount: number(row.amount),
    payment_method: text(row.payment_method) || null,
    account_id: text(row.account_id),
    account_name: text(row.account_name),
    reference: text(row.reference) || null,
    paid_on: text(row.paid_on),
    created_at: text(row.created_at),
    status: text(row.status) || "completed",
    allocations: asArray<Record<string, unknown>>(row.allocations).map<SettlementAllocationSummary>(
      (allocation) => ({
        sale_id: text(allocation.sale_id) || null,
        purchase_id: text(allocation.purchase_id) || null,
        reference_no: text(allocation.reference_no) || null,
        amount: number(allocation.amount),
      }),
    ),
  }));

  return {
    customerCollections,
    customerSales,
    supplierPayables,
    supplierPurchases,
    history,
    customerOutstanding: number(root.customer_outstanding),
    supplierOutstanding: number(root.supplier_outstanding),
    accounts,
  };
}

export async function loadSettlements(
  supabase: ServerClient,
  vendorId: string,
): Promise<SettlementsData> {
  const [overviewResult, accountsResult] = await Promise.all([
    supabase.rpc("vendor_settlements_overview", {
      p_vendor_id: vendorId,
      p_history_limit: 500,
    }),
    supabase.rpc("vendor_accounts_overview", {
      p_vendor_id: vendorId,
      p_transaction_limit: 1,
    }),
  ]);

  if (overviewResult.error) {
    if (
      overviewResult.error.code === "PGRST202" ||
      /vendor_settlements_overview/i.test(overviewResult.error.message)
    ) {
      throw new Error(
        "The settlements database functions are not installed yet. Apply the latest database migration and reload.",
      );
    }
    throw new Error(overviewResult.error.message);
  }

  const accounts = accountsResult.error
    ? []
    : normalizeAccountsOverview(accountsResult.data).accounts;

  return normalizeSettlementsOverview(overviewResult.data, accounts);
}

export async function loadSell(supabase: ServerClient, vendorId: string): Promise<SellData> {  const [productsResult, salesResult] = await Promise.all([
    supabase.from("products").select("*").eq("vendor_id", vendorId).order("name"),
    supabase
      .from("sales")
      .select<string, Sale & { sale_items: SaleItem[] }>("*, sale_items(*)")
      .eq("vendor_id", vendorId)
      .is("deleted_at", null)
      .neq("status", "refunded")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  return {
    products: (productsResult.data ?? []) as Product[],
    recentSales: ((salesResult.data ?? []) as (Sale & { sale_items: SaleItem[] })[]).map(
      ({ sale_items: items, ...sale }) => ({ ...sale, items: items ?? [] }),
    ),
  };
}

type MoneySaleRow = {
  id: string;
  order_no: string | null;
  customer_name: string | null;
  total: number;
  paid_amount: number;
  due_amount: number;
  status: string;
  sale_date: string;
  created_at: string;
  payment_method: string;
};

function sumAmounts(rows: { amount: number | string | null }[] | null | undefined): number {
  return (rows ?? []).reduce((total, row) => total + (Number(row.amount) || 0), 0);
}

export async function loadMoney(supabase: ServerClient, vendorId: string): Promise<MoneyData> {
  const monthStart = monthStartKey(currentMonthKey());
  const [
    expensesResult,
    incomeResult,
    budgetsResult,
    categoriesResult,
    financeCategoriesResult,
    accountsResult,
    monthExpensesResult,
    monthIncomeResult,
    monthSalesResult,
    recentSalesResult,
    outstandingSalesResult,
    payablesResult,
  ] = await Promise.all([
    supabase
      .from("finance_entries")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("type", "expense")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("finance_entries")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("type", "income")
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("budgets").select("*").eq("vendor_id", vendorId).order("category"),
    supabase.rpc("vendor_expense_categories", { p_vendor_id: vendorId, p_from: monthStart }),
    supabase.from("finance_categories").select("type,name").eq("vendor_id", vendorId),
    supabase.rpc("vendor_accounts_overview", {
      p_vendor_id: vendorId,
      p_transaction_limit: 300,
    }),
    supabase
      .from("finance_entries")
      .select("amount")
      .eq("vendor_id", vendorId)
      .eq("type", "expense")
      .gte("entry_date", monthStart),
    supabase
      .from("finance_entries")
      .select("amount")
      .eq("vendor_id", vendorId)
      .eq("type", "income")
      .gte("entry_date", monthStart),
    supabase
      .from("sales")
      .select("total,paid_amount,due_amount,status")
      .eq("vendor_id", vendorId)
      .gte("sale_date", monthStart)
      .neq("status", "cancelled")
      .neq("status", "refunded"),
    supabase
      .from("sales")
      .select(
        "id,order_no,customer_name,total,paid_amount,due_amount,status,sale_date,created_at,payment_method",
      )
      .eq("vendor_id", vendorId)
      .neq("status", "cancelled")
      .neq("status", "refunded")
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("sales")
      .select("id,total,paid_amount,due_amount,status")
      .eq("vendor_id", vendorId)
      .gt("due_amount", 0)
      .neq("status", "cancelled")
      .neq("status", "refunded"),
    supabase.rpc("vendor_purchases_overview", { p_vendor_id: vendorId, p_limit: 1 }),
  ]);

  const spentByCategory: Record<string, number> = {};
  asArray<ExpenseCategoryStat>(categoriesResult.data).forEach((row) => {
    spentByCategory[row.category] = Number(row.total);
  });

  const custom = (financeCategoriesResult.data ?? []) as { type: "income" | "expense"; name: string }[];
  const categoryList = (defaults: readonly string[], type: "income" | "expense") => {
    const names = new Set<string>(defaults);
    custom.forEach((row) => {
      if (row.type === type) names.add(row.name);
    });
    return [...names];
  };

  const accounts = accountsResult.error ? [] : normalizeAccountsOverview(accountsResult.data).accounts;
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const movementBySource = new Map<string, AccountMovement>();
  if (!accountsResult.error) {
    normalizeAccountsOverview(accountsResult.data).transactions.forEach((movement) => {
      if (movement.source_id && !movementBySource.has(movement.source_id)) {
        movementBySource.set(movement.source_id, movement);
      }
    });
  }

  const monthlySales = (monthSalesResult.data ?? []) as Pick<
    MoneySaleRow,
    "total" | "paid_amount" | "due_amount" | "status"
  >[];
  const salesReceived = monthlySales.reduce((total, sale) => total + saleReceivedAmount(sale), 0);
  const receivables = ((outstandingSalesResult.data ?? []) as unknown as MoneySaleRow[]).reduce(
    (total, sale) => total + saleOutstandingAmount(sale),
    0,
  );
  const purchases = (payablesResult.data ?? {}) as unknown as { outstanding?: number | string };
  const payables = Number(purchases.outstanding) || 0;

  const overview = buildMoneyOverview({
    availableFunds: totalAvailableFunds(accounts),
    salesReceivedThisMonth: salesReceived,
    otherIncomeThisMonth: sumAmounts(monthIncomeResult.data),
    expensesThisMonth: sumAmounts(monthExpensesResult.data),
    receivables,
    payables,
  });

  const accountForEntry = (entry: FinanceEntry) => {
    if (entry.account_id) {
      const account = accountById.get(entry.account_id);
      if (account) return { id: account.id, name: account.name };
    }
    const movement = movementBySource.get(entry.id);
    return {
      id: movement?.account_id ?? null,
      name: movement?.account_name ?? null,
    };
  };

  const expenses = (expensesResult.data ?? []) as FinanceEntry[];
  const income = (incomeResult.data ?? []) as FinanceEntry[];
  const recentSales = (recentSalesResult.data ?? []) as MoneySaleRow[];

  const transactions: MoneyTransaction[] = [
    ...expenses.map<MoneyTransaction>((entry) => {
      const account = accountForEntry(entry);
      return {
        id: `expense-${entry.id}`,
        kind: "expense",
        title: entry.notes?.trim() || entry.category,
        category: entry.category,
        amount: -Math.abs(Number(entry.amount) || 0),
        date: entry.entry_date,
        ts: entry.created_at,
        account_id: account.id,
        account_name: account.name,
        note: entry.notes,
      };
    }),
    ...income.map<MoneyTransaction>((entry) => {
      const account = accountForEntry(entry);
      return {
        id: `income-${entry.id}`,
        kind: "income",
        title: entry.notes?.trim() || entry.category,
        category: entry.category,
        amount: Math.abs(Number(entry.amount) || 0),
        date: entry.entry_date,
        ts: entry.created_at,
        account_id: account.id,
        account_name: account.name,
        note: entry.notes,
      };
    }),
    ...recentSales.map<MoneyTransaction>((sale) => {
      const movement = movementBySource.get(sale.id);
      const outstanding = saleOutstandingAmount(sale);
      return {
        id: `sale-${sale.id}`,
        kind: "sale",
        title: sale.customer_name?.trim()
          ? `Sale to ${sale.customer_name.trim()}`
          : `Sale ${sale.order_no?.trim() || ""}`.trim(),
        category: "Sales",
        amount: saleReceivedAmount(sale),
        date: sale.sale_date,
        ts: sale.created_at,
        account_id: movement?.account_id ?? null,
        account_name: movement?.account_name ?? sale.payment_method,
        note: outstanding > 0 ? "Part of this sale is still unpaid" : null,
        outstanding,
      };
    }),
    ...(accountsResult.error
      ? []
      : normalizeAccountsOverview(accountsResult.data).transactions
          .filter((movement) => movement.kind === "transfer")
          .map<MoneyTransaction>((movement) => ({
            id: `transfer-${movement.id}`,
            kind: "transfer",
            title: movement.notes?.trim() || "Transfer",
            category: "Transfer",
            amount: Number(movement.amount) || 0,
            date: movement.occurred_on,
            ts: movement.created_at,
            account_id: movement.account_id,
            account_name: movement.account_name,
            note: null,
          }))),
  ].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.ts ?? "").localeCompare(a.ts ?? "");
  });

  return {
    expenses,
    income,
    budgets: (budgetsResult.data ?? []) as Budget[],
    spentByCategory,
    categories: {
      expense: categoryList(EXPENSE_CATEGORIES, "expense"),
      income: categoryList(INCOME_CATEGORIES, "income"),
    },
    accounts,
    overview,
    transactions,
  };
}

function bucketLabel(key: string, group: "day" | "week" | "month") {
  return group === "month" ? monthShort(`${key}-01`) : dayMonthLabel(key);
}

export function groupMetrics(
  daily: DailyMetric[],
  start: string,
  end: string,
  group: "day" | "week" | "month",
): GroupedSeries {
  const buckets = new Map<string, string[]>();
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const key = group === "day" ? day : group === "week" ? weekStartKey(day) : day.slice(0, 7);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)?.push(day);
  }

  const entries = [...buckets.entries()];
  const byDay = new Map(daily.map((row) => [row.day, row]));
  return {
    labels: entries.map(([key]) => bucketLabel(key, group)),
    buckets: entries.map(([key, days]) => ({ key, days, label: bucketLabel(key, group) })),
    sales: entries.map(([, days]) =>
      days.reduce((total, day) => total + Number(byDay.get(day)?.sales ?? 0), 0),
    ),
    expenses: entries.map(([, days]) =>
      days.reduce((total, day) => total + Number(byDay.get(day)?.expenses ?? 0), 0),
    ),
    profit: entries.map(([, days]) =>
      days.reduce((total, day) => total + Number(byDay.get(day)?.net_profit ?? 0), 0),
    ),
  };
}

export async function loadAnalytics(
  supabase: ServerClient,
  vendorId: string,
  start: string,
  end: string,
  group: "day" | "week" | "month",
  months: number,
): Promise<AnalyticsData> {
  const length = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000) + 1;
  const previousStart = addDays(start, -length);
  const previousEnd = addDays(start, -1);
  const categoriesFrom = monthStartKey(monthsAgoKey(months - 1));

  const [dailyResult, previousResult, monthlyResult, categoriesResult, itemsResult] =
    await Promise.all([
      supabase.rpc("vendor_daily_series", { p_vendor_id: vendorId, p_from: start, p_to: end }),
      supabase.rpc("vendor_daily_series", {
        p_vendor_id: vendorId,
        p_from: previousStart,
        p_to: previousEnd,
      }),
      supabase.rpc("vendor_monthly_series", { p_vendor_id: vendorId, p_months: months }),
      supabase.rpc("vendor_expense_categories", {
        p_vendor_id: vendorId,
        p_from: categoriesFrom,
      }),
      supabase.rpc("vendor_item_stats", { p_vendor_id: vendorId }),
    ]);

  const daily = asArray<DailyMetric>(dailyResult.data);
  const previous = asArray<DailyMetric>(previousResult.data);
  const totals = daily.reduce(
    (accumulator, row) => ({
      sales: accumulator.sales + Number(row.sales),
      expenses: accumulator.expenses + Number(row.expenses),
      profit: accumulator.profit + Number(row.net_profit),
    }),
    { sales: 0, expenses: 0, profit: 0 },
  );

  return {
    daily,
    previous,
    monthly: asArray<MonthlyMetric>(monthlyResult.data),
    categories: asArray<ExpenseCategoryStat>(categoriesResult.data),
    items: asArray<ItemStat>(itemsResult.data),
    grouped: groupMetrics(daily, start, end, group),
    totals,
    previousSales: previous.reduce((total, row) => total + Number(row.sales), 0),
  };
}

export async function loadProducts(
  supabase: ServerClient,
  vendorId: string,
): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Product[];
}

export async function loadProductCategories(
  supabase: ServerClient,
  vendorId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("product_categories")
    .select("name")
    .eq("vendor_id", vendorId)
    .order("name");
  return ((data ?? []) as { name: string }[]).map((row) => row.name);
}

export async function loadCustomers(
  supabase: ServerClient,
  vendorId: string,
): Promise<Customer[]> {
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("vendor_id", vendorId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []) as Customer[];
}

export async function loadRecentSales(
  supabase: ServerClient,
  vendorId: string,
  limit = 6,
): Promise<Sale[]> {
  const { data } = await supabase
    .from("sales")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Sale[];
}
