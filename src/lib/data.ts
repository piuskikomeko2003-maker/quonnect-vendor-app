import type { createClient } from "@/lib/supabase/server";
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
  AnalyticsData,
  DailyMetric,
  ExpenseCategoryStat,
  GroupedSeries,
  HomeData,
  HomeOverview,
  ItemStat,
  MoneyData,
  MonthlyMetric,
  SellData,
  Transaction,
} from "@/lib/types";
import type { Budget, FinanceEntry, Product, Sale, SaleItem } from "@/types/app-db";

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export async function loadHome(
  supabase: ServerClient,
  vendorId: string,
  month: string,
  from: string,
  to: string,
): Promise<HomeData> {
  const [overviewResult, dailyResult, transactionsResult] = await Promise.all([
    supabase.rpc("vendor_home_overview", { p_vendor_id: vendorId, p_month: month }),
    supabase.rpc("vendor_daily_series", { p_vendor_id: vendorId, p_from: from, p_to: to }),
    supabase.rpc("vendor_recent_transactions", { p_vendor_id: vendorId, p_limit: 40 }),
  ]);

  return {
    overview: (overviewResult.data as unknown as HomeOverview) ?? {
      today: todayKey(),
      selected_month: month,
      sales_today: 0,
      sales_yesterday: 0,
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
    daily: asArray<DailyMetric>(dailyResult.data),
    transactions: asArray<Transaction>(transactionsResult.data),
  };
}

export async function loadSell(supabase: ServerClient, vendorId: string): Promise<SellData> {
  const [productsResult, salesResult] = await Promise.all([
    supabase.from("products").select("*").eq("vendor_id", vendorId).order("name"),
    supabase
      .from("sales")
      .select("*")
      .eq("vendor_id", vendorId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const sales = (salesResult.data ?? []) as Sale[];
  let items: SaleItem[] = [];
  if (sales.length) {
    const { data } = await supabase
      .from("sale_items")
      .select("*")
      .in("sale_id", sales.map((sale) => sale.id));
    items = (data ?? []) as SaleItem[];
  }

  return {
    products: (productsResult.data ?? []) as Product[],
    recentSales: sales.map((sale) => ({
      ...sale,
      items: items.filter((item) => item.sale_id === sale.id),
    })),
  };
}

export async function loadMoney(supabase: ServerClient, vendorId: string): Promise<MoneyData> {
  const monthStart = monthStartKey(currentMonthKey());
  const [expensesResult, incomeResult, budgetsResult, categoriesResult] = await Promise.all([
    supabase
      .from("finance_entries")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("type", "expense")
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("finance_entries")
      .select("*")
      .eq("vendor_id", vendorId)
      .eq("type", "income")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("budgets").select("*").eq("vendor_id", vendorId).order("category"),
    supabase.rpc("vendor_expense_categories", { p_vendor_id: vendorId, p_from: monthStart }),
  ]);

  const spentByCategory: Record<string, number> = {};
  asArray<ExpenseCategoryStat>(categoriesResult.data).forEach((row) => {
    spentByCategory[row.category] = Number(row.total);
  });

  return {
    expenses: (expensesResult.data ?? []) as FinanceEntry[],
    income: (incomeResult.data ?? []) as FinanceEntry[],
    budgets: (budgetsResult.data ?? []) as Budget[],
    spentByCategory,
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
