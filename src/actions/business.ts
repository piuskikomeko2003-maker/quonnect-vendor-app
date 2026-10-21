"use server";

import { revalidatePath } from "next/cache";
import { requireVendor } from "@/lib/auth";
import { effectivePrice } from "@/lib/product";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "@/lib/constants";
import { todayKey } from "@/lib/format";
import type {
  BudgetInput,
  CartLineInput,
  ExpenseInput,
  ExpenseUpdateInput,
  IncomeInput,
  ProductInput,
  ReceiptInput,
  SaleActionResult,
  SimpleResult,
} from "@/lib/action-types";
import type { Product } from "@/types/app-db";

function refreshBusinessPaths() {
  ["/home", "/sell", "/stock", "/money", "/analytics", "/stall", "/profile"].forEach((path) => {
    revalidatePath(path);
  });
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function cleanCategory(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
}

function cleanEntryDate(value: string) {
  return DATE_KEY.test(value) && value <= todayKey() ? value : todayKey();
}

/** Defaults live in code; anything else is stored per vendor. */
async function rememberCategory(
  supabase: Awaited<ReturnType<typeof requireVendor>>["supabase"],
  vendorId: string,
  type: "expense" | "income",
  name: string,
): Promise<SimpleResult> {
  const defaults: readonly string[] = type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  if (defaults.some((item) => item.toLowerCase() === name.toLowerCase())) return { ok: true };

  const { error } = await supabase
    .from("finance_categories")
    .insert({ vendor_id: vendorId, type, name });
  if (error && error.code !== "23505") return { ok: false, error: error.message };
  return { ok: true };
}

export async function createProductAction(input: ProductInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const name = input.name.trim();
  const price = Math.round(Number(input.price));
  const quantity = Math.max(0, Math.floor(Number(input.quantity)));

  if (!name) return { ok: false, error: "Enter an item name" };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Enter a selling price" };
  if (!Number.isFinite(quantity)) return { ok: false, error: "Enter a quantity" };

  const { error } = await supabase.from("products").insert({
    vendor_id: vendor.id,
    name,
    description: input.description.trim() || null,
    category: input.category || "Other",
    sizes: input.sizes,
    colors: input.colors,
    cost: Math.max(0, Math.round(Number(input.cost) || 0)),
    price,
    stock: quantity,
    discount_pct: Math.max(0, Math.min(90, Math.round(Number(input.discount_pct) || 0))),
    is_active: input.is_published,
    photo_url: input.photo_url,
  });

  if (error) return { ok: false, error: error.message };
  refreshBusinessPaths();
  return { ok: true };
}

export async function restockProductAction(
  productId: string,
  quantity: number,
  newCost: number | null,
  createExpense: boolean,
): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 1) return { ok: false, error: "Enter a quantity" };

  const { error } = await supabase.rpc("restock_product", {
    p_vendor_id: vendor.id,
    p_product_id: productId,
    p_qty: qty,
    p_new_cost: newCost && newCost > 0 ? Math.round(newCost) : null,
    p_create_expense: createExpense,
  });

  if (error) return { ok: false, error: error.message };
  refreshBusinessPaths();
  return { ok: true };
}

export async function setProductPublishedAction(
  productId: string,
  published: boolean,
): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const { error } = await supabase
    .from("products")
    .update({ is_active: published })
    .eq("id", productId)
    .eq("vendor_id", vendor.id);
  if (error) return { ok: false, error: error.message };
  refreshBusinessPaths();
  return { ok: true };
}

export async function setProductDiscountAction(
  productId: string,
  discount: number,
): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const pct = Math.max(0, Math.min(90, Math.round(Number(discount) || 0)));
  const { error } = await supabase
    .from("products")
    .update({ discount_pct: pct })
    .eq("id", productId)
    .eq("vendor_id", vendor.id);
  if (error) return { ok: false, error: error.message };
  refreshBusinessPaths();
  return { ok: true };
}

export async function recordSaleAction(lines: CartLineInput[]): Promise<SaleActionResult> {
  const { supabase, vendor } = await requireVendor();

  if (!lines.length) return { ok: false, error: "Cart is empty" };
  const ids = lines.map((line) => line.product_id);
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("vendor_id", vendor.id)
    .in("id", ids);

  const products = new Map(((data ?? []) as Product[]).map((product) => [product.id, product]));
  if (lines.some((line) => !products.has(line.product_id))) {
    return { ok: false, error: "A product in your cart no longer exists" };
  }
  const items = lines.map((line) => {
    const product = products.get(line.product_id)!;
    return {
      product_id: product.id,
      name: product.name,
      qty: line.qty,
      listed: effectivePrice(product),
      sold: Math.round(Number(line.sold_price)),
      cost: Number(product.cost) || 0,
    };
  });

  const { data: result, error } = await supabase.rpc("create_sale", {
    p_vendor_id: vendor.id,
    p_items: lines.map((line) => ({
      product_id: line.product_id,
      qty: line.qty,
      sold_price: line.sold_price,
    })),
    p_payment_method: "Cash",
  });

  if (error) return { ok: false, error: error.message };
  const saleResult = result as {
    sale_id: string;
    order_no: string;
    total: number;
    profit: number;
    price_reduction: number;
  };

  refreshBusinessPaths();

  return {
    ok: true,
    sale: {
      id: saleResult.sale_id,
      order_no: saleResult.order_no,
      total: Number(saleResult.total),
      profit: Number(saleResult.profit),
      price_reduction: Number(saleResult.price_reduction),
      payment_method: "Cash",
    },
    items,
  };
}

export async function saveReceiptAction(input: ReceiptInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const payment = PAYMENT_METHODS.includes(input.payment_method) ? input.payment_method : "Cash";

  const { error } = await supabase
    .from("sales")
    .update({
      customer_name: input.customer_name.trim() || null,
      customer_phone: input.customer_phone.trim() || null,
      payment_method: payment,
    })
    .eq("id", input.sale_id)
    .eq("vendor_id", vendor.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/sell");
  revalidatePath("/home");
  return { ok: true };
}

export async function addExpenseAction(input: ExpenseInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const amount = Math.round(Number(input.amount));
  const category = cleanCategory(input.category);
  if (!category) return { ok: false, error: "Choose a category" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount" };

  const remembered = await rememberCategory(supabase, vendor.id, "expense", category);
  if (!remembered.ok) return remembered;

  const { error } = await supabase.from("finance_entries").insert({
    vendor_id: vendor.id,
    type: "expense",
    category,
    amount,
    source: "manual",
    entry_date: cleanEntryDate(input.entry_date),
    notes: input.note.trim() || null,
    frequency: input.frequency === "monthly" ? "monthly" : "daily",
  });
  if (error) return { ok: false, error: error.message };
  refreshBusinessPaths();
  return { ok: true };
}

export async function updateExpenseAction(input: ExpenseUpdateInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const amount = Math.round(Number(input.amount));
  const category = cleanCategory(input.category);
  if (!input.id) return { ok: false, error: "Expense not found" };
  if (!category) return { ok: false, error: "Choose a category" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount" };

  const remembered = await rememberCategory(supabase, vendor.id, "expense", category);
  if (!remembered.ok) return remembered;

  const { data, error } = await supabase
    .from("finance_entries")
    .update({
      category,
      amount,
      entry_date: cleanEntryDate(input.entry_date),
      notes: input.note.trim() || null,
      frequency: input.frequency === "monthly" ? "monthly" : "daily",
    })
    .eq("id", input.id)
    .eq("vendor_id", vendor.id)
    .eq("type", "expense")
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Expense not found" };
  refreshBusinessPaths();
  return { ok: true };
}

export async function addIncomeAction(input: IncomeInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const amount = Math.round(Number(input.amount));
  const category = cleanCategory(input.category);
  if (!category) return { ok: false, error: "Choose a category" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount" };

  const remembered = await rememberCategory(supabase, vendor.id, "income", category);
  if (!remembered.ok) return remembered;

  const { error } = await supabase.from("finance_entries").insert({
    vendor_id: vendor.id,
    type: "income",
    category,
    amount,
    source: "manual",
    entry_date: todayKey(),
    notes: input.note.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  refreshBusinessPaths();
  return { ok: true };
}

export async function setBudgetAction(input: BudgetInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const limit = Math.round(Number(input.monthly_limit));
  const category = cleanCategory(input.category);
  if (!Number.isFinite(limit) || limit <= 0) return { ok: false, error: "Enter a limit" };
  if (!category) return { ok: false, error: "Choose an expense category" };

  const remembered = await rememberCategory(supabase, vendor.id, "expense", category);
  if (!remembered.ok) return remembered;

  const { error } = await supabase.from("budgets").upsert(
    {
      vendor_id: vendor.id,
      category,
      monthly_limit: limit,
    },
    { onConflict: "vendor_id,category" },
  );
  if (error) return { ok: false, error: error.message };
  refreshBusinessPaths();
  return { ok: true };
}
