const BUSINESS_TIME_ZONE = "Africa/Kampala";

export function formatUGX(value: number | string | null | undefined): string {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value ?? 0;
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `UGX ${safe.toLocaleString("en-US")}`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

/** Compact chart axis labels: 1.2M, 340k, 950. */
export function shortMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1_000)}k`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `${sign}${Math.round(abs)}`;
}

export function initials(name: string | null | undefined): string {
  return (
    String(name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "Q"
  );
}

export function firstName(name: string | null | undefined): string {
  return String(name ?? "").trim().split(/\s+/)[0] || "there";
}

export function formatDay(value: string | Date): string {
  const date = typeof value === "string" ? parseDateKey(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function todayKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function currentMonthKey(): string {
  return todayKey().slice(0, 7);
}

export function parseDateKey(key: string): Date {
  return new Date(`${key.slice(0, 10)}T12:00:00Z`);
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, amount: number): string {
  const date = parseDateKey(key);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
}

export function daysAgo(amount: number): string {
  return addDays(todayKey(), -amount);
}

export function monthsAgoKey(amount: number): string {
  const now = new Date();
  return dateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - amount, 1)));
}

export function monthStartKey(month: string): string {
  return `${month.slice(0, 7)}-01`;
}

export function monthEndKey(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return dateKey(new Date(Date.UTC(year, monthNumber, 0)));
}

export function monthList(count: number): string[] {
  return Array.from({ length: count }, (_, index) => monthsAgoKey(count - 1 - index).slice(0, 7));
}

export function monthKeyFromDate(key: string): string {
  return key.slice(0, 7);
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthShort(month: string): string {
  return SHORT_MONTHS[Number(month.slice(5, 7)) - 1] ?? "";
}

export function monthLong(month: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(
    parseDateKey(monthStartKey(month)),
  );
}

export function monthLongYear(month: string): string {
  return `${monthLong(month)} ${month.slice(0, 4)}`;
}

export function dayMonthLabel(key: string): string {
  const date = parseDateKey(key);
  return `${date.getUTCDate()} ${SHORT_MONTHS[date.getUTCMonth()]}`;
}

/** Home chart label, matching the prototype's mdLab(): "Oct 15". */
export function monthDayLabel(key: string): string {
  const date = parseDateKey(key);
  return `${SHORT_MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Home transaction date, matching toLocaleDateString('en-US'). */
export function usDayLabel(key: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDateKey(key));
}

export function weekdayLabel(key: string): string {
  return new Intl.DateTimeFormat("en", { weekday: "short", timeZone: "UTC" }).format(parseDateKey(key));
}

export function weekStartKey(key: string): string {
  const date = parseDateKey(key);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return dateKey(date);
}

export function clampDateRange(from: string, to: string, maxDays = 60): { from: string; to: string } {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const span = Math.round((parseDateKey(end).getTime() - parseDateKey(start).getTime()) / 86_400_000);
  if (span > maxDays - 1) return { from: addDays(end, -(maxDays - 1)), to: end };
  return { from: start, to: end };
}

export function rangeDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let key = from; key <= to; key = addDays(key, 1)) days.push(key);
  return days;
}
