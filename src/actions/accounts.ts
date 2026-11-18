import { refreshAppData } from "@/lib/query";
import { requireVendor } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import {
  ACCOUNT_KINDS,
  isAccountColor,
  isAccountIcon,
} from "@/lib/accounts";
import type {
  AccountTransferInput,
  FinancialAccountInput,
  FinancialAccountUpdateInput,
  SimpleResult,
} from "@/lib/action-types";

function clean(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanKind(value: string): string {
  return (ACCOUNT_KINDS as readonly string[]).includes(value) ? value : "";
}

/** Create a manual business account with an opening balance. */
export async function createFinancialAccountAction(
  input: FinancialAccountInput,
): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const name = clean(input.name, 80);
  const kind = cleanKind(input.kind);
  const opening = Math.round(Number(input.opening_balance) || 0);
  const description = clean(input.description, 300);
  const color = input.color && isAccountColor(input.color) ? input.color : null;
  const icon = input.icon && isAccountIcon(input.icon) ? input.icon : null;

  if (!name) return { ok: false, error: "Enter an account name" };
  if (!kind) return { ok: false, error: "Choose an account type" };
  if (!Number.isFinite(opening)) return { ok: false, error: "Enter a valid opening balance" };

  const { error } = await supabase.rpc("create_financial_account", {
    p_vendor_id: vendor.id,
    p_name: name,
    p_kind: kind,
    p_opening_balance: opening,
    p_description: description || null,
    p_color: color,
    p_icon: icon,
  });

  if (error) return { ok: false, error: userMessage(error) };
  refreshAppData();
  return { ok: true };
}

/** Edit the display details of an account. Opening balance is immutable. */
export async function updateFinancialAccountAction(
  input: FinancialAccountUpdateInput,
): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const name = clean(input.name, 80);
  const kind = cleanKind(input.kind);
  const description = clean(input.description, 300);
  const color = input.color && isAccountColor(input.color) ? input.color : null;
  const icon = input.icon && isAccountIcon(input.icon) ? input.icon : null;

  if (!input.id) return { ok: false, error: "Account not found" };
  if (!name) return { ok: false, error: "Enter an account name" };
  if (!kind) return { ok: false, error: "Choose an account type" };

  const { error } = await supabase.rpc("update_financial_account", {
    p_vendor_id: vendor.id,
    p_account_id: input.id,
    p_name: name,
    p_kind: kind,
    p_description: description || null,
    p_color: color,
    p_icon: icon,
  });

  if (error) return { ok: false, error: userMessage(error) };
  refreshAppData();
  return { ok: true };
}

/** Deactivate or reactivate an account. History is always preserved. */
export async function setFinancialAccountActiveAction(
  accountId: string,
  active: boolean,
): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  if (!accountId) return { ok: false, error: "Account not found" };

  const { error } = await supabase.rpc("set_financial_account_active", {
    p_vendor_id: vendor.id,
    p_account_id: accountId,
    p_active: active,
  });

  if (error) return { ok: false, error: userMessage(error) };
  refreshAppData();
  return { ok: true };
}

/** Move money between two active accounts with two linked ledger rows. */
export async function transferFundsAction(input: AccountTransferInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const amount = Math.round(Number(input.amount));
  const notes = clean(input.notes, 200);

  if (!input.from_account_id || !input.to_account_id) {
    return { ok: false, error: "Choose both accounts" };
  }
  if (input.from_account_id === input.to_account_id) {
    return { ok: false, error: "Choose two different accounts" };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than zero" };
  }

  const { error } = await supabase.rpc("transfer_between_accounts", {
    p_vendor_id: vendor.id,
    p_from_account_id: input.from_account_id,
    p_to_account_id: input.to_account_id,
    p_amount: amount,
    p_notes: notes || null,
  });

  if (error) return { ok: false, error: userMessage(error) };
  refreshAppData();
  return { ok: true };
}
