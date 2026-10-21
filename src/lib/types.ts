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

export interface HomeData {
  overview: HomeOverview;
  daily: DailyMetric[];
  transactions: Transaction[];
}

export interface SaleWithItems extends Sale {
  items: SaleItem[];
}

export interface SellData {
  products: Product[];
  recentSales: SaleWithItems[];
}

export interface MoneyData {
  expenses: import("@/types/app-db").FinanceEntry[];
  income: import("@/types/app-db").FinanceEntry[];
  budgets: Budget[];
  spentByCategory: Record<string, number>;
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
