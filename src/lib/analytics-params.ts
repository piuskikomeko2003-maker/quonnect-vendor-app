import {
  ANALYTICS_RANGES,
  GROUPS,
  type AnalyticsRange,
  type GroupBy,
  type Metric,
} from "@/lib/constants";
import { addDays, monthStartKey, monthsAgoKey, todayKey } from "@/lib/format";

export interface AnalyticsParams {
  range: AnalyticsRange;
  group: GroupBy;
  metrics: Metric[];
  months: number;
  cmp: "item" | "time";
  start: string;
  end: string;
}

const METRICS: Metric[] = ["sales", "expenses", "profit"];

export function analyticsRangeStart(range: AnalyticsRange): string {
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

/**
 * Shared parser so /analytics and the Business hub stay in sync when the
 * embedded analytics controls change the URL.
 */
export function parseAnalyticsParams(params: URLSearchParams): AnalyticsParams {
  const requestedRange = params.get("range") ?? undefined;
  const range = (ANALYTICS_RANGES.map(([key]) => key) as string[]).includes(
    requestedRange ?? "",
  )
    ? (requestedRange as AnalyticsRange)
    : "30d";

  const requestedGroup = params.get("group") ?? undefined;
  const group: GroupBy = GROUPS[range].includes(requestedGroup as GroupBy)
    ? (requestedGroup as GroupBy)
    : GROUPS[range][0];

  const requestedMetrics = (params.get("metrics") ?? "sales,expenses,profit")
    .split(",")
    .filter((metric): metric is Metric => METRICS.includes(metric as Metric));
  const metrics: Metric[] = requestedMetrics.length
    ? Array.from(new Set(requestedMetrics))
    : METRICS;

  const months = params.get("months") === "6" ? 6 : 12;
  const cmp = params.get("cmp") === "time" ? "time" : "item";
  const end = todayKey();

  return {
    range,
    group,
    metrics,
    months,
    cmp,
    start: analyticsRangeStart(range),
    end,
  };
}
