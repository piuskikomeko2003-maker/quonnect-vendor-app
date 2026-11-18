import { refreshAppData } from "@/lib/query";
import { requireVendor } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { todayKey } from "@/lib/format";
import { newPurchaseKey } from "@/lib/purchases";
import type {
  ReverseStockPurchaseResult,
  SimpleResult,
  StockPurchaseInput,
  StockPurchaseResult,
} from "@/lib/action-types";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

/** Record a multi-product stock purchase and its account payment atomically. */
export async function recordStockPurchaseAction(
  input: StockPurchaseInput,
): Promise<StockPurchaseResult> {
  const { supabase, vendor } = await requireVendor();

  const items = input.items
    .map((line) => ({
      product_id: line.product_id,
      qty: Math.floor(Number(line.quantity)),
      unit_cost: Math.round(Number(line.unit_cost)),
    }))
    .filter((line) => Boolean(line.product_id));

  if (!items.length) return { ok: false, error: "Add at least one product to the purchase" };

  const seen = new Set<string>();
  for (const line of items) {
    if (seen.has(line.product_id)) {
      return { ok: false, error: "Each product can only appear once in a purchase" };
    }
    seen.add(line.product_id);
    if (!Number.isFinite(line.qty) || line.qty < 1) {
      return { ok: false, error: "Enter a quantity greater than zero for every product" };
    }
    if (!Number.isFinite(line.unit_cost) || line.unit_cost < 0) {
      return { ok: false, error: "Purchase costs cannot be negative" };
    }
  }

  const amountPaid = Math.round(Number(input.amount_paid) || 0);
  if (amountPaid < 0) return { ok: false, error: "Amount paid cannot be negative" };
  if (amountPaid > 0 && !input.account_id) {
    return { ok: false, error: "Choose the account used to pay" };
  }

  const purchaseDate =
    DATE_KEY.test(input.purchase_date) && input.purchase_date <= todayKey()
      ? input.purchase_date
      : todayKey();

  const { data, error } = await supabase.rpc("record_stock_purchase", {
    p_vendor_id: vendor.id,
    p_items: items,
    p_account_id: input.account_id,
    p_amount_paid: amountPaid,
    p_supplier_name: clean(input.supplier_name, 120) || null,
    p_purchase_date: purchaseDate,
    p_notes: clean(input.notes, 500) || null,
    p_idempotency_key: clean(input.idempotency_key, 120) || newPurchaseKey(),
  });

  if (error) return { ok: false, error: userMessage(error, "Could not save this purchase") };

  const result = data as {
    purchase_id: string;
    reference_no: string | null;
    total_amount: number;
    paid_amount: number;
    due_amount: number;
    account_name?: string | null;
    account_balance_after?: number | null;
    duplicate: boolean;
  };

  refreshAppData();

  return {
    ok: true,
    purchase: {
      id: result.purchase_id,
      reference_no: result.reference_no,
      total_amount: Number(result.total_amount),
      paid_amount: Number(result.paid_amount),
      due_amount: Number(result.due_amount),
      account_name: result.account_name ?? null,
      account_balance_after:
        result.account_balance_after == null ? null : Number(result.account_balance_after),
      duplicate: Boolean(result.duplicate),
    },
  };
}

/**
 * Reverses a stock purchase while keeping the original record, its lines and
 * the account ledger. Stock is reduced and any money paid is refunded.
 */
export async function reverseStockPurchaseAction(
  purchaseId: string,
): Promise<ReverseStockPurchaseResult> {
  const { supabase, vendor } = await requireVendor();
  if (!purchaseId) {
    return { ok: false, error: "Purchase not found. Refresh and try again." };
  }

  const { data, error } = await supabase.rpc("reverse_stock_purchase", {
    p_vendor_id: vendor.id,
    p_purchase_id: purchaseId,
  });

  if (error) {
    return { ok: false, error: userMessage(error, "Could not reverse this purchase") };
  }

  const result = data as {
    purchase_id: string;
    reference_no: string | null;
    refunded_amount: number;
    account_name: string | null;
    account_balance_after: number | null;
    items_reversed: number;
  };

  refreshAppData();

  return {
    ok: true,
    reversal: {
      purchase_id: result.purchase_id,
      reference_no: result.reference_no ?? null,
      refunded_amount: Number(result.refunded_amount) || 0,
      account_name: result.account_name ?? null,
      account_balance_after:
        result.account_balance_after == null ? null : Number(result.account_balance_after),
      items_reversed: Number(result.items_reversed) || 0,
    },
  };
}

/** Kept for callers that only need a success/error shape. */
export async function recordStockPurchaseSimple(input: StockPurchaseInput): Promise<SimpleResult> {
  const result = await recordStockPurchaseAction(input);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
