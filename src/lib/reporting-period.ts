import {
  addDays,
  clampDateRange,
  dateKey,
  formatDay,
  parseDateKey,
  todayKey,
  weekStartKey,
} from "@/lib/format";

export const REPORTING_PERIODS = ["daily", "weekly", "monthly", "custom"] as const;

export type ReportingPeriod = (typeof REPORTING_PERIODS)[number];

export const PERIOD_NAMES: Record<ReportingPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

/** Keep a single dashboard request bounded so charts stay responsive. */
export const MAX_CUSTOM_DAYS = 366;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export interface ReportingRange {
  from: string;
  to: string;
}

export interface PeriodSelection extends ReportingRange {
  period: ReportingPeriod;
}

export function isReportingPeriod(value: string | null | undefined): value is ReportingPeriod {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "custom";
}

function isDateKey(value: string | null | undefined, today: string): value is string {
  return Boolean(value && DATE_KEY.test(value) && value <= today);
}

/** Shift a YYYY-MM key by whole months. */
export function shiftMonthKey(month: string, amount: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return dateKey(new Date(Date.UTC(year, monthNumber - 1 + amount, 1))).slice(0, 7);
}

/** First day of the business month that contains `day`. */
export function businessMonthStartKey(day: string, startDay: number): string {
  const safeStart = Math.min(28, Math.max(1, Math.round(Number(startDay) || 1)));
  const date = parseDateKey(day);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const start =
    date.getUTCDate() >= safeStart
      ? new Date(Date.UTC(year, month, safeStart))
      : new Date(Date.UTC(year, month - 1, safeStart));
  return dateKey(start);
}

/** A selected business month, e.g. 2026-10 => 25 Oct to 24 Nov. */
export function monthRange(month: string, startDay: number, today: string): ReportingRange {
  const safeStart = Math.min(28, Math.max(1, Math.round(Number(startDay) || 1)));
  const start = safeStart === 1 ? `${month}-01` : `${month}-${String(safeStart).padStart(2, "0")}`;
  const startDate = parseDateKey(start);
  const nextStart = dateKey(
    new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, safeStart)),
  );
  const end = addDays(nextStart, -1);
  return { from: start, to: end > today ? today : end };
}

export function defaultRange(
  period: ReportingPeriod,
  today = todayKey(),
  startDay = 1,
): ReportingRange {
  if (period === "daily") return { from: today, to: today };
  if (period === "weekly") return { from: weekStartKey(today), to: today };
  if (period === "monthly") return { from: businessMonthStartKey(today, startDay), to: today };
  return { from: addDays(today, -13), to: today };
}

/**
 * Resolve URL values into one canonical range. Invalid or future dates fall
 * back to the period default, and every range is capped to `MAX_CUSTOM_DAYS`.
 */
export function resolveReportingPeriod(
  period: ReportingPeriod,
  rawFrom: string | null | undefined,
  rawTo: string | null | undefined,
  today = todayKey(),
  startDay = 1,
): PeriodSelection {
  if (isDateKey(rawFrom, today) && isDateKey(rawTo, today)) {
    const clamped = clampDateRange(rawFrom, rawTo, MAX_CUSTOM_DAYS);
    if (period === "daily") return { period, from: clamped.to, to: clamped.to };
    return { period, ...clamped };
  }
  return { period, ...defaultRange(period, today, startDay) };
}

export interface PeriodPreset extends ReportingRange {
  key: string;
  label: string;
}

/** The two quick ranges offered above the date controls for each period. */
export function periodPresets(
  period: ReportingPeriod,
  today = todayKey(),
  startDay = 1,
): PeriodPreset[] {
  if (period === "daily") {
    return [
      { key: "today", label: "Today", from: today, to: today },
      { key: "yesterday", label: "Yesterday", from: addDays(today, -1), to: addDays(today, -1) },
    ];
  }

  if (period === "weekly") {
    const thisStart = weekStartKey(today);
    const lastEnd = addDays(thisStart, -1);
    return [
      { key: "this-week", label: "This week", from: thisStart, to: today },
      { key: "last-week", label: "Last week", from: addDays(lastEnd, -6), to: lastEnd },
    ];
  }

  if (period === "monthly") {
    const thisStart = businessMonthStartKey(today, startDay);
    const lastStart = businessMonthStartKey(addDays(thisStart, -1), startDay);
    return [
      { key: "this-month", label: "This month", from: thisStart, to: today },
      { key: "last-month", label: "Last month", from: lastStart, to: addDays(thisStart, -1) },
    ];
  }

  return [];
}

export function sameRange(a: ReportingRange, b: ReportingRange): boolean {
  return a.from === b.from && a.to === b.to;
}

/** Human label used in section subtitles and the period summary. */
export function formatPeriodLabel(from: string, to: string, today = todayKey()): string {
  if (from === to) return from === today ? `Today · ${formatDay(from)}` : formatDay(from);
  if (to === today) return `${formatDay(from)} – Today`;
  return `${formatDay(from)} – ${formatDay(to)}`;
}

/** Short range label for headings. */
export function periodRangeLabel(from: string, to: string, today = todayKey()): string {
  if (from === to) return from === today ? "today" : formatDay(from);
  return `${formatDay(from)} – ${formatDay(to)}`;
}
