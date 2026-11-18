import { parseMoneyInput } from "@/lib/validation";
import type { SettlementType, SettlementHistoryEntry } from "@/lib/types";

export type SettlementPaymentStatus = "unpaid" | "partial" | "paid";

export interface SettlementAllocationDraft {
  /** Sale id or purchase id. */
  id: string;
  outstanding: number;
  /** Raw text from the amount input. */
  amount: string;
}

export interface ValidatedSettlementDraft {
  ok: boolean;
  error?: string;
  total: number;
  allocations: { id: string; amount: number }[];
}

/** A stable key used to make one save action idempotent across retries. */
export function newSettlementKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `settlement-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Payment status shown for an individual outstanding sale or purchase. */
export function settlementPaymentStatus(
  paidValue: number | string | null | undefined,
  totalValue: number | string | null | undefined,
): SettlementPaymentStatus {
  const paid = Math.max(0, Number(paidValue ?? 0) || 0);
  const total = Math.max(0, Number(totalValue ?? 0) || 0);
  if (total <= 0 || paid >= total) return "paid";
  if (paid <= 0) return "unpaid";
  return "partial";
}

/** Human label for a settlement payment type. */
export function settlementTypeLabel(type: SettlementType | string): string {
  return type === "supplier_payment" ? "Supplier payment" : "Customer collection";
}

/**
 * Validates the amount entered against each outstanding sale or purchase.
 * Zero rows are ignored, a row can never be overpaid, and the returned total
 * is the exact amount that will move through the business account.
 */
export function validateSettlementDrafts(
  drafts: SettlementAllocationDraft[],
): ValidatedSettlementDraft {
  const allocations: { id: string; amount: number }[] = [];
  let total = 0;

  for (const draft of drafts) {
    const raw = draft.amount.trim();
    if (!raw) continue;

    const amount = parseMoneyInput(raw);
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        error: "Enter a payment amount greater than zero, or leave the row empty.",
        total: 0,
        allocations: [],
      };
    }

    const outstanding = Math.max(0, Math.round(Number(draft.outstanding) || 0));
    if (outstanding <= 0) {
      return {
        ok: false,
        error: "This balance is already fully paid.",
        total: 0,
        allocations: [],
      };
    }
    if (amount > outstanding) {
      return {
        ok: false,
        error: `A payment cannot be more than the outstanding balance of ${outstanding.toLocaleString("en-US")}.`,
        total: 0,
        allocations: [],
      };
    }

    allocations.push({ id: draft.id, amount });
    total += amount;
  }

  if (!allocations.length || total <= 0) {
    return {
      ok: false,
      error: "Enter an amount for at least one outstanding item.",
      total: 0,
      allocations: [],
    };
  }

  return { ok: true, total, allocations };
}

export interface SettlementHistoryFilters {
  search?: string;
  type?: string;
  accountId?: string;
  party?: string;
  from?: string;
  to?: string;
}

/** Shared search/filter rule so the UI and unit tests agree. */
export function matchesSettlementHistory(
  entry: SettlementHistoryEntry,
  filters: SettlementHistoryFilters,
): boolean {
  if (filters.type && filters.type !== "all" && entry.settlement_type !== filters.type) {
    return false;
  }
  if (filters.accountId && filters.accountId !== "all" && entry.account_id !== filters.accountId) {
    return false;
  }
  if (filters.party && filters.party !== "all") {
    const party = filters.party.toLowerCase();
    if (entry.party_name.toLowerCase() !== party) return false;
  }
  if (filters.from && entry.paid_on < filters.from) return false;
  if (filters.to && entry.paid_on > filters.to) return false;

  const search = filters.search?.trim().toLowerCase();
  if (!search) return true;

  return [
    entry.party_name,
    entry.reference,
    entry.account_name,
    entry.payment_method,
    ...entry.allocations.map((allocation) => allocation.reference_no),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(search));
}
