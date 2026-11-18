import { refreshAppData } from "@/lib/query";
import { requireVendor } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { PAYMENT_METHODS } from "@/lib/constants";
import { todayKey } from "@/lib/format";
import { newSettlementKey } from "@/lib/settlements";
import type {
  CustomerPaymentInput,
  SettlementPaymentResult,
  SupplierPaymentInput,
} from "@/lib/action-types";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function clean(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanDate(value: string): string {
  return DATE_KEY.test(value) && value <= todayKey() ? value : todayKey();
}

function cleanAllocations(
  allocations: { sale_id?: string; purchase_id?: string; amount: number }[],
  key: "sale_id" | "purchase_id",
): { ok: true; rows: { id: string; amount: number }[] } | { ok: false; error: string } {
  const seen = new Set<string>();
  const rows: { id: string; amount: number }[] = [];

  for (const allocation of allocations) {
    const id = (allocation[key] ?? "").trim();
    const amount = Math.round(Number(allocation.amount));
    if (!id) return { ok: false, error: "Select an outstanding item to pay" };
    if (seen.has(id)) return { ok: false, error: "Each outstanding item can only be paid once" };
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "Enter a payment amount greater than zero" };
    }
    seen.add(id);
    rows.push({ id, amount });
  }

  if (!rows.length) return { ok: false, error: "Select at least one outstanding item" };
  return { ok: true, rows };
}

function parseResult(value: unknown): SettlementPaymentResult["payment"] | null {
  if (!value || typeof value !== "object") return null;
  const result = value as Record<string, unknown>;
  const type =
    result.settlement_type === "supplier_payment" ? "supplier_payment" : "customer_collection";
  const allocations = Array.isArray(result.allocations)
    ? (result.allocations as Record<string, unknown>[]).map((allocation) => ({
        sale_id: (allocation.sale_id as string | null) ?? null,
        purchase_id: (allocation.purchase_id as string | null) ?? null,
        reference_no: (allocation.reference_no as string | null) ?? null,
        amount: Number(allocation.amount) || 0,
        due_after: Number(allocation.due_after) || 0,
      }))
    : [];
  const outstanding =
    result.customer_outstanding_after ?? result.supplier_outstanding_after ?? null;

  return {
    id: String(result.payment_id ?? ""),
    settlement_type: type,
    party_name: String(result.party_name ?? ""),
    total: Number(result.total) || 0,
    account_name: (result.account_name as string | null) ?? null,
    account_balance_after:
      result.account_balance_after == null ? null : Number(result.account_balance_after),
    party_outstanding_after: outstanding == null ? null : Number(outstanding),
    allocations,
    duplicate: Boolean(result.duplicate),
  };
}

/** Receive money from a customer against one or more outstanding sales. */
export async function recordCustomerPaymentAction(
  input: CustomerPaymentInput,
): Promise<SettlementPaymentResult> {
  const { supabase, vendor } = await requireVendor();

  const customerName = clean(input.customer_name, 120);
  if (!input.customer_id && !customerName) {
    return { ok: false, error: "Choose the customer making this payment" };
  }
  if (!input.account_id) {
    return { ok: false, error: "Choose the receiving business account" };
  }

  const cleaned = cleanAllocations(input.allocations, "sale_id");
  if (!cleaned.ok) return { ok: false, error: cleaned.error };

  const paymentMethod = PAYMENT_METHODS.includes(input.payment_method)
    ? input.payment_method
    : "Cash";

  const { data, error } = await supabase.rpc("record_customer_payment", {
    p_vendor_id: vendor.id,
    p_customer_id: input.customer_id,
    p_customer_name: customerName || null,
    p_allocations: cleaned.rows.map((row) => ({ sale_id: row.id, amount: row.amount })),
    p_payment_method: paymentMethod,
    p_account_id: input.account_id,
    p_reference: clean(input.reference, 120) || null,
    p_paid_on: cleanDate(input.paid_on),
    p_idempotency_key: clean(input.idempotency_key, 120) || newSettlementKey(),
  });

  if (error) {
    return { ok: false, error: userMessage(error, "Could not record this customer payment") };
  }

  const payment = parseResult(data);
  if (!payment) return { ok: false, error: "Could not read the saved payment" };

  refreshAppData();
  return { ok: true, payment };
}

/** Pay one or more outstanding supplier purchases from a business account. */
export async function recordSupplierPaymentAction(
  input: SupplierPaymentInput,
): Promise<SettlementPaymentResult> {
  const { supabase, vendor } = await requireVendor();

  const supplierName = clean(input.supplier_name, 120);
  if (!supplierName) return { ok: false, error: "Choose the supplier being paid" };
  if (!input.account_id) {
    return { ok: false, error: "Choose the business account used for this payment" };
  }

  const cleaned = cleanAllocations(input.allocations, "purchase_id");
  if (!cleaned.ok) return { ok: false, error: cleaned.error };

  const { data, error } = await supabase.rpc("record_supplier_payment", {
    p_vendor_id: vendor.id,
    p_supplier_name: supplierName,
    p_allocations: cleaned.rows.map((row) => ({
      purchase_id: row.id,
      amount: row.amount,
    })),
    p_account_id: input.account_id,
    p_reference: clean(input.reference, 120) || null,
    p_paid_on: cleanDate(input.paid_on),
    p_idempotency_key: clean(input.idempotency_key, 120) || newSettlementKey(),
  });

  if (error) {
    return { ok: false, error: userMessage(error, "Could not record this supplier payment") };
  }

  const payment = parseResult(data);
  if (!payment) return { ok: false, error: "Could not read the saved payment" };

  refreshAppData();
  return { ok: true, payment };
}
