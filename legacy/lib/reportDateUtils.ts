/**
 * Date and timezone utilities for the Africa/Kampala (UTC+3) timezone.
 * Ensures all period boundaries are inclusive, consistent, and never produce epoch dates.
 */

export type ReportPeriodPreset =
  | 'today'
  | 'yesterday'
  | 'last-7-days'
  | 'last-30-days'
  | 'this-month'
  | 'previous-month'
  | 'this-year'
  | 'grand-report';

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
  label: string;
}

// Convert a Date object to YYYY-MM-DD in local Kampala time (UTC+3)
export function toKampalaDateString(date: Date): string {
  // Use Intl.DateTimeFormat with Africa/Kampala timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

// Get the current Date in Kampala
export function getNowInKampala(): Date {
  return new Date();
}

/**
 * Returns inclusive date ranges for all predefined presets in Africa/Kampala time.
 */
export function getPresetDateRange(preset: ReportPeriodPreset): DateRange {
  const now = getNowInKampala();
  const todayStr = toKampalaDateString(now);

  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterdayStr = toKampalaDateString(yesterdayDate);

  switch (preset) {
    case 'today':
      return { from: todayStr, to: todayStr, label: 'Today' };

    case 'yesterday':
      return { from: yesterdayStr, to: yesterdayStr, label: 'Yesterday' };

    case 'last-7-days': {
      const fromDate = new Date(now.getTime() - 6 * 86400000);
      return { from: toKampalaDateString(fromDate), to: todayStr, label: 'Last 7 Days' };
    }

    case 'last-30-days': {
      const fromDate = new Date(now.getTime() - 29 * 86400000);
      return { from: toKampalaDateString(fromDate), to: todayStr, label: 'Last 30 Days' };
    }

    case 'this-month': {
      const parts = todayStr.split('-');
      const fromStr = `${parts[0]}-${parts[1]}-01`;
      return { from: fromStr, to: todayStr, label: 'Current Month' };
    }

    case 'previous-month': {
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-indexed current month
      const prevMonthLastDay = new Date(year, month, 0); // last day of prev month
      const prevMonthFirstDay = new Date(year, month - 1, 1);
      return {
        from: toKampalaDateString(prevMonthFirstDay),
        to: toKampalaDateString(prevMonthLastDay),
        label: 'Previous Month',
      };
    }

    case 'this-year': {
      const parts = todayStr.split('-');
      const fromStr = `${parts[0]}-01-01`;
      return { from: fromStr, to: todayStr, label: 'Current Year' };
    }

    case 'grand-report':
    default:
      return { from: '2020-01-01', to: todayStr, label: 'Grand Report (All Time)' };
  }
}

/**
 * Formats a Date range label for report headers, e.g. "Sep 1 - Sep 28, 2026"
 */
export function formatInclusiveDateRange(from: string, to: string): string {
  if (!from || !to) return 'All time';
  if (from === '2020-01-01') return 'Grand Report (All time)';

  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);

  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return `${from} to ${to}`;

  const fromD = new Date(y1, m1 - 1, d1);
  const toD = new Date(y2, m2 - 1, d2);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fromFormatted = `${d1} ${months[m1 - 1]}`;
  const toFormatted = `${d2} ${months[m2 - 1]} ${y2}`;

  if (from === to) {
    return `${d1} ${months[m1 - 1]} ${y1}`;
  }

  return `${fromFormatted} - ${toFormatted}`;
}

export function formatSingleDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}
