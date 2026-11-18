export interface PurchaseLineAmount {
  quantity: number | string | null | undefined;
  unit_cost: number | string | null | undefined;
}

export type PurchasePaymentStatus = "unpaid" | "partial" | "paid";

function whole(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

export function purchaseLineTotal(line: PurchaseLineAmount): number {
  return whole(whole(line.quantity) * whole(line.unit_cost));
}

export function purchaseGrandTotal(lines: readonly PurchaseLineAmount[]): number {
  return lines.reduce((total, line) => total + purchaseLineTotal(line), 0);
}

export function purchaseOutstanding(total: number, paid: number): number {
  return Math.max(0, whole(total) - whole(paid));
}

export function purchasePaymentStatus(total: number, paid: number): PurchasePaymentStatus {
  const safeTotal = whole(total);
  const safePaid = whole(paid);
  if (safePaid <= 0) return "unpaid";
  if (safePaid >= safeTotal) return "paid";
  return "partial";
}

/**
 * Returns the first user-facing problem, or null when the payment is valid.
 * `accountBalance` is optional so the same rule works before accounts load.
 */
export function validatePurchasePayment(
  total: number,
  paid: number,
  accountId: string | null,
  accountBalance?: number | null,
): string | null {
  const safeTotal = whole(total);
  const safePaid = whole(paid);

  if (safeTotal <= 0) return "Add at least one product with a quantity and cost";
  if (safePaid < 0) return "Amount paid cannot be negative";
  if (safePaid > safeTotal) return "Amount paid cannot be more than the total purchase cost";
  if (safePaid > 0 && !accountId) return "Choose the account used to pay";
  if (
    safePaid > 0 &&
    accountBalance !== undefined &&
    accountBalance !== null &&
    safePaid > whole(accountBalance)
  ) {
    return "The selected account does not have enough money for this payment";
  }
  return null;
}

/** Client-generated key used to make a retried purchase submit idempotent. */
export function newPurchaseKey(): string {
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID === "function") {
    return cryptoObject.randomUUID();
  }
  return `purchase-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
