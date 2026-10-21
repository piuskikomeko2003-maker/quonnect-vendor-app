import { AnalyticsScreen } from "@/components/screens/AnalyticsScreen";
import { requireVendor } from "@/lib/auth";
import { loadAnalytics } from "@/lib/data";
import {
  ANALYTICS_RANGES,
  GROUPS,
  type AnalyticsRange,
  type GroupBy,
  type Metric,
} from "@/lib/constants";
import { addDays, monthStartKey, monthsAgoKey, todayKey } from "@/lib/format";

export const metadata = { title: "Analytics · Quonnect Vendor" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function rangeStart(range: AnalyticsRange) {
  const today = todayKey();
  switch (range) {
    case "7d":
      return addDays(today, -6);
    case "30d":
      return addDays(today, -29);
    case "90d":
      return addDays(today, -89);
    case "6m":
      return monthStartKey(monthsAgoKey(5));
    case "12m":
      return monthStartKey(monthsAgoKey(11));
  }
}

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { supabase, vendor } = await requireVendor();

  const requestedRange = one(params.range);
  const range =
    (ANALYTICS_RANGES.map(([key]) => key) as string[]).includes(requestedRange ?? "")
      ? (requestedRange as AnalyticsRange)
      : "30d";

  const requestedGroup = one(params.group);
  const group: GroupBy = GROUPS[range].includes(requestedGroup as GroupBy)
    ? (requestedGroup as GroupBy)
    : GROUPS[range][0];

  const requestedMetrics = (one(params.metrics) ?? "sales,expenses,profit")
    .split(",")
    .filter((metric): metric is Metric =>
      ["sales", "expenses", "profit"].includes(metric),
    );
  const metrics: Metric[] = requestedMetrics.length
    ? Array.from(new Set(requestedMetrics))
    : ["sales", "expenses", "profit"];

  const months = one(params.months) === "6" ? 6 : 12;
  const cmp = one(params.cmp) === "time" ? "time" : "item";
  const start = rangeStart(range);
  const end = todayKey();

  const data = await loadAnalytics(supabase, vendor.id, start, end, group, months);

  return (
    <AnalyticsScreen
      data={data}
      range={range}
      group={group}
      metrics={metrics}
      months={months}
      cmp={cmp}
    />
  );
}
