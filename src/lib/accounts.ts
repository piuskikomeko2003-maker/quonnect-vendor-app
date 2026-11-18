import type { IconKey } from "@/lib/constants";

/**
 * Account types shown in the management UI.
 *
 * `mtn_momo` and `airtel_money` are kept for existing accounts created by the
 * sale payment-method mapping. Both display as "Mobile money", and the manual
 * form creates the generic `mobile_money` kind.
 */
export const ACCOUNT_TYPES = [
  { value: "cash", label: "Physical Cash", icon: "wallet", color: "#0F766E" },
  { value: "bank", label: "Bank Account", icon: "moneybag", color: "#1D4ED8" },
  { value: "mobile_money", label: "Mobile Money", icon: "mobile", color: "#B45309" },
  { value: "savings", label: "Savings", icon: "coins", color: "#7C3AED" },
  { value: "other", label: "Other", icon: "wallet", color: "#4B5563" },
] as const;

export type AccountKind = (typeof ACCOUNT_TYPES)[number]["value"];

export const ACCOUNT_KINDS = [
  "cash",
  "bank",
  "mtn_momo",
  "airtel_money",
  "mobile_money",
  "savings",
  "other",
] as const;

export const ACCOUNT_COLORS = [
  "#0F766E",
  "#1D4ED8",
  "#B45309",
  "#7C3AED",
  "#BE123C",
  "#4B5563",
] as const;

export const ACCOUNT_ICON_CHOICES: { value: IconKey; label: string }[] = [
  { value: "wallet", label: "Wallet" },
  { value: "moneybag", label: "Money bag" },
  { value: "mobile", label: "Mobile phone" },
  { value: "coins", label: "Coins" },
  { value: "store", label: "Shop" },
  { value: "box", label: "Box" },
];

const LEGACY_MOBILE_KINDS = new Set(["mtn_momo", "airtel_money", "mobile_money"]);

export function isAccountKind(value: string): value is AccountKind {
  return ACCOUNT_TYPES.some((type) => type.value === value);
}

/** Value used by the account form, collapsing legacy mobile kinds. */
export function accountTypeValue(kind: string): AccountKind {
  if (LEGACY_MOBILE_KINDS.has(kind)) return "mobile_money";
  return isAccountKind(kind) ? kind : "other";
}

export function accountKindLabel(kind: string): string {
  if (LEGACY_MOBILE_KINDS.has(kind)) return "Mobile Money";
  return ACCOUNT_TYPES.find((type) => type.value === kind)?.label ?? "Other";
}

export function accountTypeDefaults(kind: string) {
  return (
    ACCOUNT_TYPES.find((type) => type.value === accountTypeValue(kind)) ?? ACCOUNT_TYPES[4]
  );
}

export function accountIcon(kind: string, icon?: string | null): IconKey {
  const choice = ACCOUNT_ICON_CHOICES.find((item) => item.value === icon);
  return choice?.value ?? accountTypeDefaults(kind).icon;
}

export function accountColor(kind: string, color?: string | null): string {
  return /^#[0-9a-f]{6}$/i.test(color ?? "")
    ? (color as string)
    : accountTypeDefaults(kind).color;
}

export function isAccountColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function isAccountIcon(value: string): value is IconKey {
  return ACCOUNT_ICON_CHOICES.some((item) => item.value === value);
}

/**
 * The only supported balance definition: opening balance plus every recorded
 * movement. Kept pure so the UI and tests cannot drift.
 */
export function deriveAccountBalance(
  openingBalance: number | string | null | undefined,
  movements: readonly (number | string | null | undefined)[],
): number {
  const opening = Number(openingBalance ?? 0);
  if (!Number.isFinite(opening)) return 0;
  return movements.reduce<number>((total, amount) => {
    const value = Number(amount ?? 0);
    return Number.isFinite(value) ? total + value : total;
  }, opening);
}

export function totalAvailableFunds(
  accounts: readonly { balance: number; is_active: boolean }[],
): number {
  return accounts
    .filter((account) => account.is_active)
    .reduce((total, account) => total + (Number(account.balance) || 0), 0);
}

/** A non-zero account must be emptied by transfer before deactivation. */
export function canDeactivateAccount(balance: number): boolean {
  return Math.round(Number(balance) || 0) === 0;
}

export function movementLabel(kind: string): string {
  switch (kind) {
    case "sale_payment":
      return "Sale received";
    case "expense_payment":
      return "Expense paid";
    case "other_income":
      return "Other income";
    case "stock_purchase_payment":
      return "Stock purchase paid";
    case "transfer":
      return "Transfer";
    case "reversal":
      return "Reversal";
    default:
      return "Money movement";
  }
}
