import { refreshAppData } from "@/lib/query";
import { requireVendor } from "@/lib/auth";
import { userMessage } from "@/lib/errors";
import { effectivePrice } from "@/lib/product";
import { cleanProductImageUrls } from "@/lib/product-images";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, PRODUCT_CATEGORIES } from "@/lib/constants";
import { todayKey } from "@/lib/format";
import type {
  BudgetInput,
  CartLineInput,
  CustomerInput,
  ExpenseInput,
  ExpenseUpdateInput,
  FinanceEntryResult,
  IncomeInput,
  ProductInput,
  ProductUpdateInput,
  ReceiptInput,
  ReverseFinanceEntryResult,
  ReverseSaleResult,
  SaleActionResult,
  SaleCustomerInput,
  SimpleResult,
} from "@/lib/action-types";
import type { Customer, Product } from "@/types/app-db";

function refreshBusinessPaths() {
  refreshAppData();
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function cleanCategory(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
}

function cleanEntryDate(value: string) {
  return DATE_KEY.test(value) && value <= todayKey() ? value : todayKey();
}

/** PostgREST reports a missing table as PGRST205; older setups use 42P01. */
function isMissingTable(error: { code?: string | null; message: string }) {
  return error.code === "PGRST205" || error.code === "42P01";
}

/** PostgREST reports an unknown column as PGRST204; raw Postgres uses 42703. */
function isMissingPhotoGallery(error: { code?: string | null; message: string }) {
  return (
    (error.code === "PGRST204" || error.code === "42703") &&
    /photo_urls/i.test(error.message)
  );
}

function isMissingColumn(error: { code?: string | null; message: string }, column: string) {
  return (
    (error.code === "PGRST204" || error.code === "42703") &&
    new RegExp(column, "i").test(error.message)
  );
}

type FinanceEntryPayload = {
  vendor_id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  source?: string;
  entry_date?: string;
  notes?: string | null;
  frequency?: "daily" | "monthly";
  account_id?: string | null;
};
type FinanceWriteError = { code?: string | null; message: string };

/**
 * Writes a finance entry and degrades gracefully when an older database is
 * missing the newer `account_id` or `frequency` columns.
 */
async function writeFinanceEntry(
  supabase: Awaited<ReturnType<typeof requireVendor>>["supabase"],
  entry: FinanceEntryPayload,
  accountId: string | null,
  updateId?: string,
): Promise<{ error: FinanceWriteError | null; updated: boolean; entryId: string | null }> {
  const withoutFrequency = { ...entry };
  delete withoutFrequency.frequency;
  const variants: FinanceEntryPayload[] = [
    { ...entry, account_id: accountId },
    { ...withoutFrequency, account_id: accountId },
    entry,
    withoutFrequency,
  ];

  let lastError: FinanceWriteError | null = null;
  for (const payload of variants) {
    if (updateId) {
      const { data, error } = await supabase
        .from("finance_entries")
        .update(payload)
        .eq("id", updateId)
        .eq("vendor_id", entry.vendor_id)
        .select("id");
      if (!error) {
        return {
          error: data?.length ? null : { message: "Entry not found" },
          updated: true,
          entryId: data?.[0]?.id ?? updateId,
        };
      }
      lastError = error;
      if (!isMissingColumn(error, "account_id") && !isMissingColumn(error, "frequency")) break;
      continue;
    }

    const { data, error } = await supabase
      .from("finance_entries")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (!error) return { error: null, updated: false, entryId: data?.id ?? null };
    lastError = error;
    if (!isMissingColumn(error, "account_id") && !isMissingColumn(error, "frequency")) break;
  }

  return { error: lastError, updated: false, entryId: null };
}

type AccountBalanceSnapshot = { name: string | null; balance: number | null };

/**
 * Reads the account and balance behind a finance entry after its trigger has
 * written the movement. Falls back to the requested account when an older
 * database does not expose the account ledger.
 */
async function financeEntryAccount(
  supabase: Awaited<ReturnType<typeof requireVendor>>["supabase"],
  vendorId: string,
  entryId: string | null,
  fallbackAccountId: string | null,
): Promise<AccountBalanceSnapshot> {
  let accountId = fallbackAccountId;

  if (entryId) {
    const { data: movement } = await supabase
      .from("account_transactions")
      .select("account_id")
      .eq("vendor_id", vendorId)
      .eq("source_type", "finance_entry")
      .eq("source_id", entryId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (movement?.account_id) accountId = movement.account_id;
  }

  if (!accountId) return { name: null, balance: null };

  const { data: account } = await supabase
    .from("financial_accounts")
    .select("name, opening_balance")
    .eq("id", accountId)
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (!account) return { name: null, balance: null };

  const { data: movements } = await supabase
    .from("account_transactions")
    .select("amount")
    .eq("vendor_id", vendorId)
    .eq("account_id", accountId);

  const balance =
    Number(account.opening_balance || 0) +
    (movements ?? []).reduce((total, row) => total + (Number(row.amount) || 0), 0);

  return { name: account.name, balance };
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
  if (error && error.code !== "23505") {
    // Older databases may not have the custom-categories table yet.
    if (isMissingTable(error)) return { ok: true };
    return { ok: false, error: userMessage(error) };
  }
  return { ok: true };
}

async function rememberProductCategory(
  supabase: Awaited<ReturnType<typeof requireVendor>>["supabase"],
  vendorId: string,
  name: string,
) {
  const clean = cleanCategory(name);
  if (!clean) return;
  if ((PRODUCT_CATEGORIES as readonly string[]).some((item) => item.toLowerCase() === clean.toLowerCase())) {
    return;
  }

  const { error } = await supabase
    .from("product_categories")
    .insert({ vendor_id: vendorId, name: clean });
  if (error && error.code !== "23505" && !isMissingTable(error)) {
    console.error("Could not remember product category:", error.message);
  }
}

export async function addProductCategoryAction(name: string): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const clean = cleanCategory(name);
  if (!clean) return { ok: false, error: "Enter a category name" };

  const { error } = await supabase
    .from("product_categories")
    .insert({ vendor_id: vendor.id, name: clean });
  if (error) {
    if (isMissingTable(error)) {
      return {
        ok: false,
        error: "Category storage is not set up yet. Apply the latest database migration.",
      };
    }
    if (error.code !== "23505") return { ok: false, error: userMessage(error) };
  }

  refreshBusinessPaths();
  return { ok: true };
}

export async function deleteProductCategoryAction(name: string): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const clean = cleanCategory(name);
  if (!clean) return { ok: false, error: "Category not found" };

  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("vendor_id", vendor.id)
    .eq("name", clean);

  if (error) {
    if (isMissingTable(error)) {
      return {
        ok: false,
        error: "Category storage is not set up yet. Apply the latest database migration.",
      };
    }
    return { ok: false, error: userMessage(error) };
  }
  refreshBusinessPaths();
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

  const photoUrls = cleanProductImageUrls(input.photo_urls);

  await rememberProductCategory(supabase, vendor.id, input.category || "Other");

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
    photo_urls: photoUrls,
    photo_url: photoUrls[0] ?? null,
  });

  if (error) {
    if (isMissingPhotoGallery(error)) {
      return {
        ok: false,
        error: "Multi-photo storage is not set up yet. Apply the latest database migration.",
      };
    }
    return { ok: false, error: userMessage(error) };
  }
  refreshBusinessPaths();
  return { ok: true };
}

export async function updateProductAction(input: ProductUpdateInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const name = input.name.trim();
  const price = Math.round(Number(input.price));
  const quantity = Math.max(0, Math.floor(Number(input.quantity)));

  if (!input.id) return { ok: false, error: "Product not found" };
  if (!name) return { ok: false, error: "Enter an item name" };
  if (!Number.isFinite(price) || price <= 0) return { ok: false, error: "Enter a selling price" };
  if (!Number.isFinite(quantity)) return { ok: false, error: "Enter a quantity" };

  const photoUrls = cleanProductImageUrls(input.photo_urls);

  await rememberProductCategory(supabase, vendor.id, input.category || "Other");

  const { data, error } = await supabase
    .from("products")
    .update({
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
      photo_urls: photoUrls,
      photo_url: photoUrls[0] ?? null,
    })
    .eq("id", input.id)
    .eq("vendor_id", vendor.id)
    .select("id");

  if (error) {
    if (isMissingPhotoGallery(error)) {
      return {
        ok: false,
        error: "Multi-photo storage is not set up yet. Apply the latest database migration.",
      };
    }
    return { ok: false, error: userMessage(error) };
  }
  if (!data?.length) return { ok: false, error: "Product not found" };
  refreshBusinessPaths();
  return { ok: true };
}

export async function setProductPublishedAction(
  productId: string,
  published: boolean,
): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const { data, error } = await supabase
    .from("products")
    .update({ is_active: published })
    .eq("id", productId)
    .eq("vendor_id", vendor.id)
    .select("id");
  if (error) return { ok: false, error: userMessage(error) };
  if (!data?.length) return { ok: false, error: "Product not found. Refresh and try again." };
  refreshBusinessPaths();
  return { ok: true };
}

export async function setProductDiscountAction(
  productId: string,
  discount: number,
): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const pct = Math.max(0, Math.min(90, Math.round(Number(discount) || 0)));
  const { data, error } = await supabase
    .from("products")
    .update({ discount_pct: pct })
    .eq("id", productId)
    .eq("vendor_id", vendor.id)
    .select("id");
  if (error) return { ok: false, error: userMessage(error) };
  if (!data?.length) return { ok: false, error: "Product not found. Refresh and try again." };
  refreshBusinessPaths();
  return { ok: true };
}

async function saveCustomerForSale(
  supabase: Awaited<ReturnType<typeof requireVendor>>["supabase"],
  vendorId: string,
  name: string,
  phone: string,
  total: number,
): Promise<{ id: string | null; error: string | null }> {
  const cleanName = name.trim() || phone.trim();
  const cleanPhone = phone.trim();
  if (!cleanName) return { id: null, error: null };

  let query = supabase
    .from("customers")
    .select("*")
    .eq("vendor_id", vendorId)
    .is("deleted_at", null);
  query = cleanPhone
    ? query.eq("phone", cleanPhone)
    : query.ilike("name", cleanName);

  const { data, error } = await query.limit(1);
  if (error) return { id: null, error: userMessage(error) };

  const existing = (data?.[0] ?? null) as Customer | null;
  if (existing) {
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        total_orders: Number(existing.total_orders || 0) + 1,
        total_spent: Number(existing.total_spent || 0) + total,
        ...(existing.phone || !cleanPhone ? {} : { phone: cleanPhone }),
      })
      .eq("id", existing.id);
    return { id: existing.id, error: updateError?.message ?? null };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("customers")
    .insert({
      vendor_id: vendorId,
      name: cleanName,
      phone: cleanPhone || null,
      total_orders: 1,
      total_spent: total,
    })
    .select("id")
    .single();

  return { id: inserted?.id ?? null, error: insertError?.message ?? null };
}

export async function addCustomerAction(input: CustomerInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const name = input.name.trim();
  const phone = input.phone.trim();

  if (!name) return { ok: false, error: "Enter a customer name" };

  if (phone) {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("vendor_id", vendor.id)
      .eq("phone", phone)
      .is("deleted_at", null)
      .limit(1);
    if (error) return { ok: false, error: userMessage(error) };
    if (data?.length) return { ok: false, error: "A customer with this phone already exists" };
  }

  const { error } = await supabase.from("customers").insert({
    vendor_id: vendor.id,
    name,
    phone: phone || null,
    email: input.email.trim() || null,
    address: input.address.trim() || null,
    notes: input.notes.trim() || null,
  });

  if (error) return { ok: false, error: userMessage(error) };
  refreshBusinessPaths();
  return { ok: true };
}

export async function recordSaleAction(
  lines: CartLineInput[],
  customer?: SaleCustomerInput | null,
): Promise<SaleActionResult> {
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

  if (error) return { ok: false, error: userMessage(error) };
  const saleResult = result as {
    sale_id: string;
    order_no: string;
    total: number;
    profit: number;
    price_reduction: number;
  };

  let warning: string | undefined;
  const customerName = customer?.name?.trim() ?? "";
  const customerPhone = customer?.phone?.trim() ?? "";

  if (customerName || customerPhone) {
    const linked = await saveCustomerForSale(
      supabase,
      vendor.id,
      customerName,
      customerPhone,
      Number(saleResult.total),
    );

    if (linked.error) {
      warning = `Sale saved, but the customer could not be saved: ${linked.error}`;
    }

    const { error: saleCustomerError } = await supabase
      .from("sales")
      .update({
        customer_id: linked.id,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
      })
      .eq("id", saleResult.sale_id)
      .eq("vendor_id", vendor.id);

    if (saleCustomerError && !warning) {
      warning = `Sale saved, but the customer details could not be attached. ${userMessage(
        saleCustomerError,
        "You can add the customer again later.",
      )}`;
    }
  }

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
    warning,
  };
}

export async function saveReceiptAction(input: ReceiptInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const payment = PAYMENT_METHODS.includes(input.payment_method) ? input.payment_method : "Cash";
  const customerName = input.customer_name.trim();
  const customerPhone = input.customer_phone.trim();

  const { data: sale, error: saleError } = await supabase
    .from("sales")
    .select("id, total, customer_id")
    .eq("id", input.sale_id)
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  if (saleError) return { ok: false, error: saleError.message };
  if (!sale) return { ok: false, error: "Sale not found" };

  let customerId = sale.customer_id;

  if (customerName || customerPhone) {
    if (customerId) {
      const { error: customerError } = await supabase
        .from("customers")
        .update({
          ...(customerName ? { name: customerName } : {}),
          ...(customerPhone ? { phone: customerPhone } : {}),
        })
        .eq("id", customerId);
      if (customerError) return { ok: false, error: customerError.message };
    } else {
      const linked = await saveCustomerForSale(
        supabase,
        vendor.id,
        customerName,
        customerPhone,
        Number(sale.total),
      );
      if (linked.id) customerId = linked.id;
    }
  }

  const { error } = await supabase
    .from("sales")
    .update({
      customer_id: customerId,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      payment_method: payment,
    })
    .eq("id", input.sale_id)
    .eq("vendor_id", vendor.id);

  if (error) return { ok: false, error: userMessage(error) };
  refreshBusinessPaths();
  return { ok: true };
}

/**
 * Reverses a sale: stock goes back, money received is refunded and the sale is
 * marked refunded instead of being erased. The original sale, its items and
 * the account ledger stay available for history.
 */
export async function reverseSaleAction(saleId: string): Promise<ReverseSaleResult> {
  const { supabase, vendor } = await requireVendor();
  if (!saleId) return { ok: false, error: "Sale not found. Refresh and try again." };

  const { data, error } = await supabase.rpc("reverse_sale", {
    p_vendor_id: vendor.id,
    p_sale_id: saleId,
  });

  if (error) {
    return { ok: false, error: userMessage(error, "Could not reverse this sale") };
  }

  const result = data as {
    sale_id: string;
    order_no: string | null;
    total: number;
    refunded_amount: number;
    account_name?: string | null;
    account_balance_after?: number | null;
    items_reversed: number;
  };

  refreshBusinessPaths();

  return {
    ok: true,
    reversal: {
      sale_id: result.sale_id,
      order_no: result.order_no ?? "",
      total: Number(result.total) || 0,
      refunded_amount: Number(result.refunded_amount) || 0,
      account_name: result.account_name ?? null,
      account_balance_after:
        result.account_balance_after == null ? null : Number(result.account_balance_after),
      items_reversed: Number(result.items_reversed) || 0,
    },
  };
}

export async function addExpenseAction(input: ExpenseInput): Promise<FinanceEntryResult> {
  const { supabase, vendor } = await requireVendor();
  const amount = Math.round(Number(input.amount));
  const category = cleanCategory(input.category);
  const entryDate = cleanEntryDate(input.entry_date);
  if (!category) return { ok: false, error: "Choose a category" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount" };

  const remembered = await rememberCategory(supabase, vendor.id, "expense", category);
  if (!remembered.ok) return remembered;

  const { error, entryId } = await writeFinanceEntry(
    supabase,
    {
      vendor_id: vendor.id,
      type: "expense",
      category,
      amount,
      source: "manual",
      entry_date: entryDate,
      notes: input.note.trim() || null,
      frequency: input.frequency === "monthly" ? "monthly" : "daily",
    },
    input.account_id || null,
  );
  if (error) return { ok: false, error: userMessage(error, "Could not save this expense") };

  const account = await financeEntryAccount(supabase, vendor.id, entryId, input.account_id || null);
  refreshBusinessPaths();
  return {
    ok: true,
    entry: {
      id: entryId ?? "",
      type: "expense",
      category,
      amount,
      entry_date: entryDate,
      account_name: account.name,
      account_balance_after: account.balance,
      updated: false,
    },
  };
}

export async function updateExpenseAction(input: ExpenseUpdateInput): Promise<FinanceEntryResult> {
  const { supabase, vendor } = await requireVendor();
  const amount = Math.round(Number(input.amount));
  const category = cleanCategory(input.category);
  const entryDate = cleanEntryDate(input.entry_date);
  if (!input.id) return { ok: false, error: "Expense not found" };
  if (!category) return { ok: false, error: "Choose a category" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount" };

  const remembered = await rememberCategory(supabase, vendor.id, "expense", category);
  if (!remembered.ok) return remembered;

  const { error, entryId } = await writeFinanceEntry(
    supabase,
    {
      vendor_id: vendor.id,
      type: "expense",
      category,
      amount,
      entry_date: entryDate,
      notes: input.note.trim() || null,
      frequency: input.frequency === "monthly" ? "monthly" : "daily",
    },
    input.account_id || null,
    input.id,
  );

  if (error) return { ok: false, error: userMessage(error, "Could not update this expense") };

  const account = await financeEntryAccount(
    supabase,
    vendor.id,
    entryId ?? input.id,
    input.account_id || null,
  );
  refreshBusinessPaths();
  return {
    ok: true,
    entry: {
      id: entryId ?? input.id,
      type: "expense",
      category,
      amount,
      entry_date: entryDate,
      account_name: account.name,
      account_balance_after: account.balance,
      updated: true,
    },
  };
}

export async function addIncomeAction(input: IncomeInput): Promise<FinanceEntryResult> {
  const { supabase, vendor } = await requireVendor();
  const amount = Math.round(Number(input.amount));
  const category = cleanCategory(input.category);
  const entryDate = cleanEntryDate(input.entry_date || todayKey());
  if (!category) return { ok: false, error: "Choose a category" };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount" };

  const remembered = await rememberCategory(supabase, vendor.id, "income", category);
  if (!remembered.ok) return remembered;

  const { error, entryId } = await writeFinanceEntry(
    supabase,
    {
      vendor_id: vendor.id,
      type: "income",
      category,
      amount,
      source: "manual",
      entry_date: entryDate,
      notes: input.note.trim() || null,
    },
    input.account_id || null,
  );
  if (error) return { ok: false, error: userMessage(error, "Could not save this income") };

  const account = await financeEntryAccount(supabase, vendor.id, entryId, input.account_id || null);
  refreshBusinessPaths();
  return {
    ok: true,
    entry: {
      id: entryId ?? "",
      type: "income",
      category,
      amount,
      entry_date: entryDate,
      account_name: account.name,
      account_balance_after: account.balance,
      updated: false,
    },
  };
}

/**
 * Reverses a manual expense or income. The finance entry is removed from
 * reports, while the database trigger writes a matching reversal into the
 * append-only account ledger, so the money history remains explainable.
 */
export async function reverseFinanceEntryAction(
  entryId: string,
): Promise<ReverseFinanceEntryResult> {
  const { supabase, vendor } = await requireVendor();
  if (!entryId) return { ok: false, error: "Transaction not found. Refresh and try again." };

  const { data: entry, error: readError } = await supabase
    .from("finance_entries")
    .select("id,type,category,amount,account_id")
    .eq("id", entryId)
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  if (readError) {
    return { ok: false, error: userMessage(readError, "Could not read this transaction") };
  }
  if (!entry) {
    return { ok: false, error: "This transaction was not found. Refresh and try again." };
  }

  const { data: deleted, error } = await supabase
    .from("finance_entries")
    .delete()
    .eq("id", entryId)
    .eq("vendor_id", vendor.id)
    .select("id");

  if (error) {
    return { ok: false, error: userMessage(error, "Could not reverse this transaction") };
  }
  if (!deleted?.length) {
    return { ok: false, error: "This transaction was already reversed. Refresh and try again." };
  }

  const account = await financeEntryAccount(supabase, vendor.id, entryId, entry.account_id);

  refreshBusinessPaths();
  return {
    ok: true,
    reversal: {
      id: entryId,
      type: entry.type === "income" ? "income" : "expense",
      category: entry.category,
      amount: Number(entry.amount) || 0,
      account_name: account.name,
      account_balance_after: account.balance,
    },
  };
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
  if (error) return { ok: false, error: userMessage(error) };
  refreshBusinessPaths();
  return { ok: true };
}
