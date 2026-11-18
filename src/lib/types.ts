import type { Budget, Product, Sale, SaleItem, Stall, Vendor } from "@/types/app-db";

export interface DailyMetric {
  day: string;
  sales: number;
  gross_profit: number;
  price_reduction: number;
  expected_revenue: number;
  expenses: number;
  operating_expenses: number;
  other_income: number;
  net_profit: number;
}

export interface MonthlyMetric {
  month: string;
  sales: number;
  gross_profit: number;
  cogs: number;
  expected_revenue: number;
  expenses: number;
  operating_expenses: number;
  other_income: number;
  net_profit: number;
}

export interface ItemStat {
  name: string;
  cost: number;
  expected: number;
  actual: number;
  sold: number;
}

export interface ExpenseCategoryStat {
  category: string;
  total: number;
}

export interface Transaction {
  id: string;
  kind: "sale" | "expense" | "income";
  title: string;
  category: string;
  amount: number;
  date: string;
  ts: string | null;
  items: string[] | null;
}

export interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  category: string | null;
  photo_url: string | null;
  price: number;
  cost: number;
  discount_pct: number;
}

export interface HomeOverview {
  today: string;
  selected_month: string;
  sales_today: number;
  sales_yesterday: number;
  net_today: number;
  net_yesterday: number;
  expenses_today: number;
  expenses_yesterday: number;
  net_month: number;
  net_prev_month: number;
  month: {
    sales: number;
    gross_profit: number;
    price_reduction: number;
    other_income: number;
    expenses: number;
    net_profit: number;
  };
  budget: { spent: number; total: number };
  low_stock: LowStockProduct[];
}

export interface HomeExtras {
  orders_today: number;
  orders_yesterday: number;
  customers_today: number;
  customers_yesterday: number;
  income_today: number;
  income_yesterday: number;
  top_items: ItemStat[];
}

export interface HomeData {
  overview: HomeOverview;
  daily: DailyMetric[];
  transactions: Transaction[];
  extras: HomeExtras;
}

export interface CashMetric {
  day: string;
  cash_in: number;
  cash_out: number;
}

export interface DashboardPeriodTotals {
  from: string;
  to: string;
  sales: number;
  gross_profit: number;
  price_reduction: number;
  other_income: number;
  expenses: number;
  operating_expenses: number;
  net_profit: number;
  orders: number;
  customers: number;
}

export interface DashboardAccount {
  id: string;
  name: string;
  kind: string;
  opening_balance: number;
  balance: number;
  is_active: boolean;
}

export interface AccountSummary extends DashboardAccount {
  description: string | null;
  color: string | null;
  icon: string | null;
  movement_count: number;
  last_activity: string | null;
}

export interface AccountMovement {
  id: string;
  account_id: string;
  account_name: string;
  amount: number;
  kind: string;
  source_type: string | null;
  source_id: string | null;
  occurred_on: string;
  notes: string | null;
  created_at: string;
}

export interface AccountsData {
  accounts: AccountSummary[];
  transactions: AccountMovement[];
}

export interface PurchaseItemSummary {
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

export interface StockPurchaseRecord {
  id: string;
  reference_no: string | null;
  supplier_name: string | null;
  account_id: string | null;
  account_name: string | null;
  purchase_date: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  notes: string | null;
  created_at: string;
  items: PurchaseItemSummary[];
}

export interface SupplierPayable {
  supplier_name: string;
  due_amount: number;
  purchase_count: number;
  last_purchase_date: string | null;
}

export interface PurchasesData {
  purchases: StockPurchaseRecord[];
  supplierPayables: SupplierPayable[];
  outstanding: number;
}

export interface DashboardCurrent {
  available_funds: number;
  customer_outstanding: number;
  stock_value: number;
  stock_units: number;
  accounts: DashboardAccount[];
}

export interface DashboardData {
  period: DashboardPeriodTotals;
  daily: DailyMetric[];
  cash: CashMetric[];
  categories: ExpenseCategoryStat[];
  items: ItemStat[];
  transactions: Transaction[];
  current: DashboardCurrent;
  low_stock: LowStockProduct[];
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface SellData {
  products: Product[];
  recentSales: SaleWithItems[];
}

export interface MoneyOverview {
  available_funds: number;
  received_this_month: number;
  sales_received_this_month: number;
  other_income_this_month: number;
  expenses_this_month: number;
  profit_this_month: number;
  receivables: number;
  payables: number;
}

export type MoneyTransactionKind = "sale" | "expense" | "income" | "transfer";

export interface MoneyTransaction {
  id: string;
  kind: MoneyTransactionKind;
  title: string;
  category: string;
  /** Signed amount: money in is positive, money out is negative. */
  amount: number;
  date: string;
  ts: string | null;
  account_id: string | null;
  account_name: string | null;
  note: string | null;
  outstanding?: number;
}

export interface BudgetProgress {
  limit: number;
  spent: number;
  remaining: number;
  percent: number;
  status: "ok" | "close" | "over";
}

export interface MoneyData {
  expenses: import("@/types/app-db").FinanceEntry[];
  income: import("@/types/app-db").FinanceEntry[];
  budgets: Budget[];
  spentByCategory: Record<string, number>;
  categories: { expense: string[]; income: string[] };
  accounts: AccountSummary[];
  overview: MoneyOverview;
  transactions: MoneyTransaction[];
}

export type SettlementType = "customer_collection" | "supplier_payment";

export interface OutstandingCustomerSale {
  id: string;
  order_no: string | null;
  customer_id: string | null;
  customer_key: string;
  customer_name: string;
  customer_phone: string | null;
  sale_date: string;
  total: number;
  paid_amount: number;
  due_amount: number;
  status: string;
}

export interface CustomerCollectionSummary {
  customer_key: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  outstanding: number;
  sale_count: number;
  oldest_sale_date: string | null;
  last_payment_date: string | null;
}

export interface OutstandingSupplierPurchase {
  id: string;
  reference_no: string | null;
  supplier_key: string;
  supplier_name: string;
  purchase_date: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  notes: string | null;
}

export interface SupplierPayableSummary {
  supplier_key: string;
  supplier_name: string;
  outstanding: number;
  purchase_count: number;
  oldest_purchase_date: string | null;
  last_payment_date: string | null;
}

export interface SettlementAllocationSummary {
  sale_id: string | null;
  purchase_id: string | null;
  reference_no: string | null;
  amount: number;
}

export interface SettlementHistoryEntry {
  id: string;
  settlement_type: SettlementType;
  customer_id: string | null;
  party_name: string;
  amount: number;
  payment_method: string | null;
  account_id: string;
  account_name: string;
  reference: string | null;
  paid_on: string;
  created_at: string;
  status: string;
  allocations: SettlementAllocationSummary[];
}

export interface SettlementsData {
  customerCollections: CustomerCollectionSummary[];
  customerSales: OutstandingCustomerSale[];
  supplierPayables: SupplierPayableSummary[];
  supplierPurchases: OutstandingSupplierPurchase[];
  history: SettlementHistoryEntry[];
  customerOutstanding: number;
  supplierOutstanding: number;
  accounts: AccountSummary[];
}

export interface GroupedSeries {
  labels: string[];
  sales: number[];
  expenses: number[];
  profit: number[];
  buckets: { key: string; days: string[]; label: string }[];
}

export interface AnalyticsData {
  daily: DailyMetric[];
  previous: DailyMetric[];
  monthly: MonthlyMetric[];
  categories: ExpenseCategoryStat[];
  items: ItemStat[];
  grouped: GroupedSeries;
  totals: { sales: number; expenses: number; profit: number };
  previousSales: number;
}

export interface StallData {
  vendor: Vendor;
  stall: Stall;
  products: Product[];
}

export interface ProfileData {
  vendor: Vendor;
  stall: Stall;
}

export type ReceiptItem = {
  name: string;
  qty: number;
  listed: number;
  sold: number;
  cost: number;
};

export type ReceiptSale = {
  id: string;
  orderNo: string;
  date: string;
  total: number;
  profit: number;
  priceReduction: number;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  items: ReceiptItem[];
};
