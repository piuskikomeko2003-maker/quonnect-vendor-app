import { todayKey } from "@/lib/format";

/**
 * Parses money entered by a vendor. Accepts "50,000", "UGX 50000" and
 * "50000.00" but rejects partial or negative input. UGX is stored as a whole
 * number, so the result is rounded.
 */
export function parseMoneyInput(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  const raw = String(value ?? "")
    .trim()
    .replace(/^UGX\s*/i, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!raw) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

/** Parses a whole count such as stock quantity or units purchased. */
export function parseWholeInput(value: string | number | null | undefined): number | null {
  const raw = String(value ?? "").trim().replace(/,/g, "").replace(/\s+/g, "");
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** True for a real calendar date that is not after today. */
export function isValidEntryDate(value: string, today = todayKey()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }
  return value <= today;
}

export interface MoneyEntryValidation {
  amount: number | null;
  category: string;
  entryDate: string;
  accountId: string | null;
  requireAccount?: boolean;
  today?: string;
}

/** Shared validation for expenses, income and other money entries. */
export function validateMoneyEntry(input: MoneyEntryValidation): string | null {
  if (!input.category.trim()) return "Choose or type a category";
  if (!Number.isFinite(input.amount) || (input.amount ?? 0) <= 0) {
    return "Enter an amount greater than zero";
  }
  if (!isValidEntryDate(input.entryDate, input.today)) {
    return "Choose a valid date that is not in the future";
  }
  if (input.requireAccount && !input.accountId) {
    return "Choose the account that moved the money";
  }
  return null;
}

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isValidPhone(value: string): boolean {
  const phone = value.trim();
  if (!phone) return true;
  return phone.replace(/\D/g, "").length >= 9;
}
