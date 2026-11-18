/**
 * End-to-end database acceptance tests. Requires a reachable Supabase project
 * with all migrations applied and a service-role key (dev only).
 *
 *   npx tsx scripts/acceptance-tests.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const PRODUCTION_PROJECT_REF = "akfktjvckvlfclkwjppn";

function projectRef(value: string): string | null {
  const match = value.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

if (
  projectRef(url) === PRODUCTION_PROJECT_REF &&
  process.env.ALLOW_PRODUCTION_ACCEPTANCE !== "1"
) {
  console.error(
    "Refusing to run acceptance tests against the production project. Point at a staging branch/project or set ALLOW_PRODUCTION_ACCEPTANCE=1 explicitly.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const stamp = Date.now();
const createdUsers: string[] = [];
let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}`, detail ?? "");
  }
}

async function createVendor(label: string) {
  const email = `qv-accept-${stamp}-${label}@example.com`;
  const password = "Test1234!";
  const { data: user, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      owner_name: `Test ${label}`,
      business_name: `Test Stall ${label}`,
      category: "Fashion & clothing",
      region: "Kampala",
      phone: "+256700000000",
    },
  });
  if (error || !user.user) throw error ?? new Error("Could not create test user");
  createdUsers.push(user.user.id);

  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;

  const { data: vendor, error: vendorError } = await client
    .from("vendors")
    .select("*")
    .eq("user_id", user.user.id)
    .single();
  if (vendorError || !vendor) throw vendorError ?? new Error("Signup trigger did not create a vendor");

  await client.from("stalls").upsert(
    { vendor_id: vendor.id, name: `Test Stall ${label}`, accent_color: "#0F8A4D" },
    { onConflict: "vendor_id" },
  );

  return { client, vendor, email };
}

async function main() {
  const a = await createVendor("a");
  const b = await createVendor("b");

  // 1. Product + atomic sale with price override.
  const { data: product, error: productError } = await a.client
    .from("products")
    .insert({
      vendor_id: a.vendor.id,
      name: "Acceptance Jeans",
      category: "Trousers & jeans",
      price: 27000,
      cost: 16000,
      stock: 9,
      is_active: true,
    })
    .select("*")
    .single();
  check("product created with qty 9", Boolean(product) && product.stock === 9, productError);

  const { data: saleResult, error: saleError } = await a.client.rpc("create_sale", {
    p_vendor_id: a.vendor.id,
    p_items: [{ product_id: product.id, qty: 1, sold_price: 25000 }],
    p_payment_method: "Cash",
  });
  check("sale RPC succeeded", !saleError, saleError);
  const saleId = (saleResult as { sale_id?: string } | null)?.sale_id;
  check("sale returned id", Boolean(saleId));

  const { data: afterProduct } = await a.client
    .from("products")
    .select("stock")
    .eq("id", product.id)
    .single();
  check("stock drops to 8", afterProduct?.stock === 8, afterProduct);

  const { data: sale } = await a.client
    .from("sales")
    .select("total, profit, price_reduction")
    .eq("id", saleId)
    .single();
  check("sale total is 25,000", Number(sale?.total) === 25000, sale);
  check("sale profit is 9,000", Number(sale?.profit) === 9000, sale);
  check("price reduction is 2,000", Number(sale?.price_reduction) === 2000, sale);

  const { data: saleItem } = await a.client
    .from("sale_items")
    .select("listed_price, sold_price, unit_cost, quantity")
    .eq("sale_id", saleId)
    .single();
  check(
    "sale item stores listed/sold/cost snapshots",
    Number(saleItem?.listed_price) === 27000 &&
      Number(saleItem?.sold_price) === 25000 &&
      Number(saleItem?.unit_cost) === 16000,
    saleItem,
  );

  const monthKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());

  const { data: overviewBefore } = await a.client.rpc("vendor_home_overview", {
    p_vendor_id: a.vendor.id,
    p_month: monthKey,
  });
  const before = overviewBefore as {
    net_month: number;
    month: { price_reduction: number; sales: number };
  };
  check("home shows 2,000 price reductions", Number(before?.month?.price_reduction) === 2000, before);

  // 2. Stock purchase must not change net profit.
  await a.client.from("finance_entries").insert({
    vendor_id: a.vendor.id,
    type: "expense",
    category: "Stock purchase",
    amount: 500000,
    source: "manual",
    notes: "Acceptance restock",
  });
  const { data: overviewStock } = await a.client.rpc("vendor_home_overview", {
    p_vendor_id: a.vendor.id,
    p_month: monthKey,
  });
  const afterStock = overviewStock as { net_month: number };
  check(
    "stock purchase does not change net profit",
    Number(afterStock?.net_month) === Number(before?.net_month),
    { before: before?.net_month, after: afterStock?.net_month },
  );

  // 3. A loss day gives negative daily net profit (red bar input).
  await a.client.from("finance_entries").insert({
    vendor_id: a.vendor.id,
    type: "expense",
    category: "Transport",
    amount: 100000,
    source: "manual",
    notes: "Acceptance loss day",
  });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const { data: daily } = await a.client.rpc("vendor_daily_series", {
    p_vendor_id: a.vendor.id,
    p_from: today,
    p_to: today,
  });
  const todayRow = (daily as { net_profit: number }[] | null)?.[0];
  check("loss day net profit is negative", Number(todayRow?.net_profit) < 0, todayRow);

  // 4. Month dropdown data changes.
  const previousMonthDate = new Date();
  previousMonthDate.setUTCMonth(previousMonthDate.getUTCMonth() - 1, 1);
  const previousMonth = previousMonthDate.toISOString().slice(0, 7);
  const { data: overviewPrevious } = await a.client.rpc("vendor_home_overview", {
    p_vendor_id: a.vendor.id,
    p_month: previousMonth,
  });
  const previous = overviewPrevious as { month: { sales: number } };
  check("previous month figures differ", Number(previous?.month?.sales) === 0, previous);

  // 5. Publish, hide and discount.
  await a.client.from("products").update({ is_active: false }).eq("id", product.id);
  const { data: hidden } = await a.client.from("products").select("is_active").eq("id", product.id).single();
  check("product can be hidden", hidden?.is_active === false, hidden);
  await a.client.from("products").update({ is_active: true, discount_pct: 10 }).eq("id", product.id);
  const { data: discounted } = await a.client
    .from("products")
    .select("is_active, discount_pct")
    .eq("id", product.id)
    .single();
  check(
    "product can be published with a deal",
    discounted?.is_active === true && discounted?.discount_pct === 10,
    discounted,
  );

  // 6. RLS: vendor B cannot read or write vendor A data.
  const { data: otherVendors } = await b.client.from("vendors").select("id").eq("id", a.vendor.id);
  check("vendor B cannot see vendor A", (otherVendors ?? []).length === 0, otherVendors);

  const { data: otherProducts } = await b.client.from("products").select("id").eq("vendor_id", a.vendor.id);
  check("vendor B cannot see vendor A products", (otherProducts ?? []).length === 0, otherProducts);

  const { data: updateRows } = await b.client
    .from("products")
    .update({ price: 1 })
    .eq("id", product.id)
    .select("id");
  check("vendor B cannot update vendor A products", (updateRows ?? []).length === 0, updateRows);

  const { error: crossInsertError } = await b.client.from("products").insert({
    vendor_id: a.vendor.id,
    name: "Cross vendor product",
    price: 1000,
    stock: 1,
  });
  check("vendor B cannot insert into vendor A", Boolean(crossInsertError), crossInsertError);

  const { error: crossSaleError } = await b.client.rpc("create_sale", {
    p_vendor_id: a.vendor.id,
    p_items: [{ product_id: product.id, qty: 1, sold_price: 1 }],
  });
  check("vendor B cannot sell vendor A stock", Boolean(crossSaleError), crossSaleError);

  // 7. Dashboard: current figures are period-independent and account-backed.
  const { data: accounts } = await a.client
    .from("financial_accounts")
    .select("name, opening_balance")
    .eq("vendor_id", a.vendor.id)
    .order("name");
  check(
    "new vendor gets Cash and MTN accounts",
    (accounts ?? []).length === 2 &&
      (accounts ?? []).some((row) => row.name === "Cash") &&
      (accounts ?? []).some((row) => row.name === "MTN Mobile Money"),
    accounts,
  );

  const { data: dashToday, error: dashTodayError } = await a.client.rpc("vendor_dashboard", {
    p_vendor_id: a.vendor.id,
    p_from: today,
    p_to: today,
  });
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  const { data: dashRange } = await a.client.rpc("vendor_dashboard", {
    p_vendor_id: a.vendor.id,
    p_from: start.toISOString().slice(0, 10),
    p_to: today,
  });

  const todayDash = dashToday as {
    current?: { available_funds: number; customer_outstanding: number; stock_value: number };
    period?: { sales: number };
  } | null;
  const rangeDash = dashRange as {
    current?: { available_funds: number };
    period?: { sales: number };
  } | null;

  check("dashboard RPC succeeded", !dashTodayError, dashTodayError);
  check(
    "available funds is independent of the reporting period",
    Number(todayDash?.current?.available_funds) === Number(rangeDash?.current?.available_funds),
    { today: todayDash?.current?.available_funds, range: rangeDash?.current?.available_funds },
  );
  check(
    "paid sale and expenses update available funds",
    Number(todayDash?.current?.available_funds) === 25000 - 500000 - 100000,
    todayDash?.current?.available_funds,
  );
  check(
    "unpaid invoices are not available funds",
    Number(todayDash?.current?.customer_outstanding) === 0,
    todayDash?.current?.customer_outstanding,
  );
  check(
    "stock value is reported separately",
    Number(todayDash?.current?.stock_value) === 8 * 16000,
    todayDash?.current?.stock_value,
  );
  check(
    "period sales respond to the selected range",
    Number(rangeDash?.period?.sales) >= Number(todayDash?.period?.sales),
    { today: todayDash?.period?.sales, range: rangeDash?.period?.sales },
  );

  // 8. Manual business accounts: create, edit, transfer and safe deactivation.
  const accountName = `Acceptance Savings ${stamp}`;
  const { data: createdAccount, error: createAccountError } = await a.client.rpc(
    "create_financial_account",
    {
      p_vendor_id: a.vendor.id,
      p_name: accountName,
      p_kind: "savings",
      p_opening_balance: 50000,
      p_description: "Emergency fund",
      p_color: "#7C3AED",
      p_icon: "coins",
    },
  );
  const createdAccountId = (createdAccount as { id?: string } | null)?.id;
  check("manual account created with opening balance", !createAccountError && Boolean(createdAccountId), createAccountError);

  const { data: updatedAccount, error: updateAccountError } = await a.client.rpc(
    "update_financial_account",
    {
      p_vendor_id: a.vendor.id,
      p_account_id: createdAccountId,
      p_name: `${accountName} Box`,
      p_kind: "savings",
      p_description: "Emergency fund and savings",
      p_color: "#7C3AED",
      p_icon: "coins",
    },
  );
  check(
    "account name and description can be edited",
    !updateAccountError &&
      (updatedAccount as { name?: string; description?: string } | null)?.name === `${accountName} Box` &&
      (updatedAccount as { description?: string } | null)?.description === "Emergency fund and savings",
    updateAccountError,
  );

  const { data: overview, error: overviewError } = await a.client.rpc("vendor_accounts_overview", {
    p_vendor_id: a.vendor.id,
    p_transaction_limit: 100,
  });
  const overviewAccounts = ((overview as { accounts?: { id: string; balance: number }[] } | null)?.accounts ?? []);
  const createdOverview = overviewAccounts.find((row) => row.id === createdAccountId);
  check(
    "account balance equals opening balance before movements",
    !overviewError && Number(createdOverview?.balance) === 50000,
    { overviewError, createdOverview },
  );

  const { data: cashAccount } = await a.client
    .from("financial_accounts")
    .select("id")
    .eq("vendor_id", a.vendor.id)
    .eq("name", "Cash")
    .single();

  const { error: blockedDeactivateError } = await a.client.rpc("set_financial_account_active", {
    p_vendor_id: a.vendor.id,
    p_account_id: createdAccountId,
    p_active: false,
  });
  check("a funded account cannot be deactivated", Boolean(blockedDeactivateError), blockedDeactivateError);

  const { error: transferError } = await a.client.rpc("transfer_between_accounts", {
    p_vendor_id: a.vendor.id,
    p_from_account_id: createdAccountId,
    p_to_account_id: cashAccount?.id,
    p_amount: 50000,
    p_notes: "Move savings to cash",
  });
  check("money can be transferred between accounts", !transferError, transferError);

  const { data: overviewAfterTransfer } = await a.client.rpc("vendor_accounts_overview", {
    p_vendor_id: a.vendor.id,
    p_transaction_limit: 100,
  });
  const afterTransferAccounts =
    ((overviewAfterTransfer as { accounts?: { id: string; balance: number }[] } | null)?.accounts ?? []);
  const emptiedAccount = afterTransferAccounts.find((row) => row.id === createdAccountId);
  check("transfer empties the source and funds the destination", Number(emptiedAccount?.balance) === 0, emptiedAccount);

  const { error: deactivateError } = await a.client.rpc("set_financial_account_active", {
    p_vendor_id: a.vendor.id,
    p_account_id: createdAccountId,
    p_active: false,
  });
  check("an emptied account can be deactivated", !deactivateError, deactivateError);

  const { data: accountHistory } = await a.client
    .from("account_transactions")
    .select("id, kind")
    .eq("vendor_id", a.vendor.id)
    .eq("account_id", createdAccountId);
  check(
    "deactivation keeps account transaction history",
    (accountHistory ?? []).length === 1 &&
      (accountHistory ?? []).every((row) => row.kind === "transfer"),
    accountHistory,
  );

  // 9. Stock purchases: cash, duplicate submit, credit, partial and transfer.
  const { data: purchaseAccount, error: purchaseAccountError } = await a.client.rpc(
    "create_financial_account",
    {
      p_vendor_id: a.vendor.id,
      p_name: `Acceptance Purchase Account ${stamp}`,
      p_kind: "bank",
      p_opening_balance: 1000000,
    },
  );
  const purchaseAccountId = (purchaseAccount as { id?: string } | null)?.id;
  check("purchase account created", !purchaseAccountError && Boolean(purchaseAccountId), purchaseAccountError);

  const { data: purchaseProduct, error: purchaseProductError } = await a.client
    .from("products")
    .insert({
      vendor_id: a.vendor.id,
      name: `Acceptance Purchase Item ${stamp}`,
      category: "Other",
      price: 8000,
      cost: 5000,
      stock: 0,
      is_active: true,
    })
    .select("id")
    .single();
  check("purchase product created", Boolean(purchaseProduct?.id), purchaseProductError);

  const cashPurchaseKey = `purchase-cash-${stamp}`;
  const { data: cashPurchase, error: cashPurchaseError } = await a.client.rpc(
    "record_stock_purchase",
    {
      p_vendor_id: a.vendor.id,
      p_items: [{ product_id: purchaseProduct?.id, qty: 10, unit_cost: 5000 }],
      p_account_id: purchaseAccountId,
      p_amount_paid: 50000,
      p_supplier_name: "Acceptance Supplier",
      p_idempotency_key: cashPurchaseKey,
    },
  );
  check("fully paid stock purchase succeeds", !cashPurchaseError, cashPurchaseError);

  const { data: afterCashPurchase } = await a.client
    .from("products")
    .select("stock, cost")
    .eq("id", purchaseProduct?.id)
    .single();
  check("cash purchase increases stock", afterCashPurchase?.stock === 10, afterCashPurchase);

  const { data: purchaseOverview } = await a.client.rpc("vendor_purchases_overview", {
    p_vendor_id: a.vendor.id,
    p_limit: 20,
  });
  const overviewPurchaseRows =
    ((purchaseOverview as { purchases?: { id: string; paid_amount: number; due_amount: number }[] } | null)
      ?.purchases ?? []);
  const cashPurchaseRow = overviewPurchaseRows.find(
    (row) => row.id === (cashPurchase as { purchase_id?: string } | null)?.purchase_id,
  );
  check(
    "fully paid purchase has no payable",
    Number(cashPurchaseRow?.paid_amount) === 50000 && Number(cashPurchaseRow?.due_amount) === 0,
    cashPurchaseRow,
  );

  const { data: duplicatePurchase, error: duplicatePurchaseError } = await a.client.rpc(
    "record_stock_purchase",
    {
      p_vendor_id: a.vendor.id,
      p_items: [{ product_id: purchaseProduct?.id, qty: 10, unit_cost: 5000 }],
      p_account_id: purchaseAccountId,
      p_amount_paid: 50000,
      p_supplier_name: "Acceptance Supplier",
      p_idempotency_key: cashPurchaseKey,
    },
  );
  check(
    "duplicate purchase key returns the original purchase",
    !duplicatePurchaseError &&
      (duplicatePurchase as { duplicate?: boolean } | null)?.duplicate === true,
    duplicatePurchaseError,
  );

  const { data: afterDuplicate } = await a.client
    .from("products")
    .select("stock")
    .eq("id", purchaseProduct?.id)
    .single();
  check("duplicate purchase does not increase stock twice", afterDuplicate?.stock === 10, afterDuplicate);

  const { error: creditPurchaseError } = await a.client.rpc(
    "record_stock_purchase",
    {
      p_vendor_id: a.vendor.id,
      p_items: [{ product_id: purchaseProduct?.id, qty: 5, unit_cost: 6000 }],
      p_account_id: null,
      p_amount_paid: 0,
      p_supplier_name: "Acceptance Supplier",
      p_idempotency_key: `purchase-credit-${stamp}`,
    },
  );
  check("credit stock purchase succeeds", !creditPurchaseError, creditPurchaseError);

  const { error: partialPurchaseError } = await a.client.rpc(
    "record_stock_purchase",
    {
      p_vendor_id: a.vendor.id,
      p_items: [{ product_id: purchaseProduct?.id, qty: 2, unit_cost: 7000 }],
      p_account_id: purchaseAccountId,
      p_amount_paid: 4000,
      p_supplier_name: "Acceptance Supplier",
      p_idempotency_key: `purchase-partial-${stamp}`,
    },
  );
  check("partial stock purchase succeeds", !partialPurchaseError, partialPurchaseError);

  const { data: afterAllPurchases } = await a.client
    .from("products")
    .select("stock")
    .eq("id", purchaseProduct?.id)
    .single();
  check("credit and partial purchases increase stock", afterAllPurchases?.stock === 17, afterAllPurchases);

  const { data: purchaseAccountsOverview } = await a.client.rpc("vendor_accounts_overview", {
    p_vendor_id: a.vendor.id,
    p_transaction_limit: 200,
  });
  const purchaseAccounts =
    ((purchaseAccountsOverview as { accounts?: { id: string; balance: number }[] } | null)?.accounts ?? []);
  const purchaseAccountBalance = Number(
    purchaseAccounts.find((row) => row.id === purchaseAccountId)?.balance,
  );
  check(
    "only paid amounts leave the purchase account",
    purchaseAccountBalance === 1000000 - 50000 - 4000,
    purchaseAccountBalance,
  );

  const { data: purchasePayables } = await a.client.rpc("vendor_purchases_overview", {
    p_vendor_id: a.vendor.id,
    p_limit: 20,
  });
  const payableRows =
    ((purchasePayables as { supplier_payables?: { supplier_name: string; due_amount: number }[] } | null)
      ?.supplier_payables ?? []);
  const supplierPayable = payableRows.find((row) => row.supplier_name === "Acceptance Supplier");
  check(
    "credit and partial balances become supplier payables",
    Number(supplierPayable?.due_amount) === 30000 + 10000,
    supplierPayable,
  );

  const totalBeforeTransfer = purchaseAccounts.reduce(
    (total, row) => total + Number(row.balance),
    0,
  );
  const { data: cashBeforeTransfer } = await a.client.rpc("vendor_accounts_overview", {
    p_vendor_id: a.vendor.id,
    p_transaction_limit: 200,
  });
  const cashBefore = Number(
    ((cashBeforeTransfer as { accounts?: { id: string; balance: number }[] } | null)?.accounts ?? []).find(
      (row) => row.id === cashAccount?.id,
    )?.balance,
  );

  const { error: purchaseTransferError } = await a.client.rpc("transfer_between_accounts", {
    p_vendor_id: a.vendor.id,
    p_from_account_id: purchaseAccountId,
    p_to_account_id: cashAccount?.id,
    p_amount: 200000,
    p_notes: "Acceptance 200k transfer",
  });
  check("200,000 transfer succeeds", !purchaseTransferError, purchaseTransferError);

  const { data: afterTransferOverview } = await a.client.rpc("vendor_accounts_overview", {
    p_vendor_id: a.vendor.id,
    p_transaction_limit: 200,
  });
  const afterPurchaseTransferAccounts =
    ((afterTransferOverview as { accounts?: { id: string; balance: number }[] } | null)?.accounts ?? []);
  const purchaseAfterTransfer = Number(
    afterPurchaseTransferAccounts.find((row) => row.id === purchaseAccountId)?.balance,
  );
  const cashAfterTransfer = Number(
    afterPurchaseTransferAccounts.find((row) => row.id === cashAccount?.id)?.balance,
  );
  check(
    "transfer reduces the source and increases the destination",
    purchaseAfterTransfer === purchaseAccountBalance - 200000 &&
      cashAfterTransfer === cashBefore + 200000,
    { purchaseAfterTransfer, cashAfterTransfer },
  );
  const totalAfterTransfer = afterPurchaseTransferAccounts.reduce(
    (total, row) => total + Number(row.balance),
    0,
  );
  check(
    "transfer leaves total funds unchanged",
    totalAfterTransfer === totalBeforeTransfer,
    { totalAfterTransfer, totalBeforeTransfer, cashBefore, cashAfterTransfer },
  );

  // 10. Reversing a stock purchase restores stock, refunds the payment and
  // keeps the original purchase plus the reversal in the ledger.
  const cashPurchaseId = (cashPurchase as { purchase_id?: string } | null)?.purchase_id;
  const { data: reverseResult, error: reverseError } = await a.client.rpc(
    "reverse_stock_purchase",
    {
      p_vendor_id: a.vendor.id,
      p_purchase_id: cashPurchaseId,
    },
  );
  check("stock purchase reversal succeeds", !reverseError, reverseError);
  check(
    "reversal refunds the amount that was paid",
    Number((reverseResult as { refunded_amount?: number } | null)?.refunded_amount) === 50000,
    reverseResult,
  );

  const { data: afterReverseProduct } = await a.client
    .from("products")
    .select("stock")
    .eq("id", purchaseProduct?.id)
    .single();
  check(
    "reversal removes the purchased stock",
    afterReverseProduct?.stock === 7,
    afterReverseProduct,
  );

  const { data: afterReverseOverview } = await a.client.rpc("vendor_accounts_overview", {
    p_vendor_id: a.vendor.id,
    p_transaction_limit: 200,
  });
  const afterReverseAccounts =
    ((afterReverseOverview as { accounts?: { id: string; balance: number }[] } | null)?.accounts ?? []);
  const purchaseAfterReverse = Number(
    afterReverseAccounts.find((row) => row.id === purchaseAccountId)?.balance,
  );
  check(
    "reversal returns money to the payment account",
    purchaseAfterReverse === purchaseAfterTransfer + 50000,
    { purchaseAfterReverse, purchaseAfterTransfer },
  );

  const { data: afterReversePurchases } = await a.client.rpc("vendor_purchases_overview", {
    p_vendor_id: a.vendor.id,
    p_limit: 20,
  });
  const afterReverseRows =
    ((afterReversePurchases as { purchases?: { id: string }[] } | null)?.purchases ?? []);
  check(
    "reversed purchase leaves the active purchase list",
    !afterReverseRows.some((row) => row.id === cashPurchaseId),
    afterReverseRows,
  );

  const { error: doubleReverseError } = await a.client.rpc("reverse_stock_purchase", {
    p_vendor_id: a.vendor.id,
    p_purchase_id: cashPurchaseId,
  });
  check("a purchase cannot be reversed twice", Boolean(doubleReverseError), doubleReverseError);

  // 11. Reversing a sale returns stock, refunds the money received and keeps
  // the sale record as refunded.
  const { data: cashBeforeSaleOverview } = await a.client.rpc("vendor_accounts_overview", {
    p_vendor_id: a.vendor.id,
    p_transaction_limit: 200,
  });
  const cashBeforeSale = Number(
    ((cashBeforeSaleOverview as { accounts?: { id: string; balance: number }[] } | null)?.accounts ?? [])
      .find((row) => row.id === cashAccount?.id)?.balance,
  );

  const { data: reversalSale, error: reversalSaleError } = await a.client.rpc("create_sale", {
    p_vendor_id: a.vendor.id,
    p_items: [{ product_id: purchaseProduct?.id, qty: 2, sold_price: 8000 }],
    p_payment_method: "Cash",
  });
  check("sale created for reversal test", !reversalSaleError, reversalSaleError);
  const reversalSaleId = (reversalSale as { sale_id?: string } | null)?.sale_id;

  const { data: afterReversalSale } = await a.client
    .from("products")
    .select("stock")
    .eq("id", purchaseProduct?.id)
    .single();
  check("sale reduces stock before reversal", afterReversalSale?.stock === 5, afterReversalSale);

  const { data: reverseSaleResult, error: reverseSaleError } = await a.client.rpc("reverse_sale", {
    p_vendor_id: a.vendor.id,
    p_sale_id: reversalSaleId,
  });
  check("sale reversal succeeds", !reverseSaleError, reverseSaleError);
  check(
    "sale reversal refunds the received amount",
    Number((reverseSaleResult as { refunded_amount?: number } | null)?.refunded_amount) === 16000,
    reverseSaleResult,
  );

  const { data: afterReverseSale } = await a.client
    .from("products")
    .select("stock")
    .eq("id", purchaseProduct?.id)
    .single();
  check("sale reversal restores stock", afterReverseSale?.stock === 7, afterReverseSale);

  const { data: cashAfterReverseSaleOverview } = await a.client.rpc("vendor_accounts_overview", {
    p_vendor_id: a.vendor.id,
    p_transaction_limit: 200,
  });
  const cashAfterReverseSale = Number(
    ((cashAfterReverseSaleOverview as { accounts?: { id: string; balance: number }[] } | null)
      ?.accounts ?? []).find((row) => row.id === cashAccount?.id)?.balance,
  );
  check(
    "sale reversal restores the account balance",
    cashAfterReverseSale === cashBeforeSale,
    { cashAfterReverseSale, cashBeforeSale },
  );

  const { data: reversedSaleRow } = await a.client
    .from("sales")
    .select("status,deleted_at")
    .eq("id", reversalSaleId)
    .single();
  check(
    "reversed sale keeps a refunded record",
    reversedSaleRow?.status === "refunded" && Boolean(reversedSaleRow?.deleted_at),
    reversedSaleRow,
  );

  // 12. Settlements: customer collections, supplier payments, partial and
  // multiple allocations, account updates and duplicate protection.
  const { data: settlementCustomer, error: customerError } = await a.client
    .from("customers")
    .insert({
      vendor_id: a.vendor.id,
      name: `Settlement Customer ${stamp}`,
      phone: `+2567${String(stamp).slice(-8)}`,
    })
    .select("id")
    .single();
  check("settlement customer created", Boolean(settlementCustomer?.id), customerError);

  const { data: settlementAccount, error: settlementAccountError } = await a.client.rpc(
    "create_financial_account",
    {
      p_vendor_id: a.vendor.id,
      p_name: `Settlement Account ${stamp}`,
      p_kind: "bank",
      p_opening_balance: 100000,
    },
  );
  const settlementAccountId = (settlementAccount as { id?: string } | null)?.id;
  check(
    "settlement receiving account created",
    !settlementAccountError && Boolean(settlementAccountId),
    settlementAccountError,
  );

  async function accountBalance(accountId: string | undefined): Promise<number> {
    const { data } = await a.client.rpc("vendor_accounts_overview", {
      p_vendor_id: a.vendor.id,
      p_transaction_limit: 300,
    });
    return Number(
      ((data as { accounts?: { id: string; balance: number }[] } | null)?.accounts ?? []).find(
        (row) => row.id === accountId,
      )?.balance,
    );
  }

  const { data: salesBeforeSettlement } = await a.client
    .from("sales")
    .select("id")
    .eq("vendor_id", a.vendor.id);
  const salesCountBefore = salesBeforeSettlement?.length ?? 0;
  const { data: expensesBeforeSettlement } = await a.client
    .from("finance_entries")
    .select("id")
    .eq("vendor_id", a.vendor.id)
    .eq("type", "expense");
  const expenseCountBefore = expensesBeforeSettlement?.length ?? 0;

  const settlementDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const { data: openSaleOne, error: openSaleOneError } = await a.client
    .from("sales")
    .insert({
      vendor_id: a.vendor.id,
      order_no: `S-SETTLE-1-${stamp}`,
      customer_id: settlementCustomer?.id,
      customer_name: `Settlement Customer ${stamp}`,
      sale_date: settlementDate,
      status: "credit",
      total: 100000,
      subtotal: 100000,
      paid_amount: 0,
      due_amount: 100000,
    })
    .select("id")
    .single();
  const { data: openSaleTwo, error: openSaleTwoError } = await a.client
    .from("sales")
    .insert({
      vendor_id: a.vendor.id,
      order_no: `S-SETTLE-2-${stamp}`,
      customer_id: settlementCustomer?.id,
      customer_name: `Settlement Customer ${stamp}`,
      sale_date: settlementDate,
      status: "credit",
      total: 60000,
      subtotal: 60000,
      paid_amount: 0,
      due_amount: 60000,
    })
    .select("id")
    .single();
  check(
    "two outstanding sales created",
    Boolean(openSaleOne?.id) && Boolean(openSaleTwo?.id),
    openSaleOneError ?? openSaleTwoError,
  );

  const balanceBeforeCollections = await accountBalance(settlementAccountId);
  const partialKey = `customer-partial-${stamp}`;
  const { data: partialCollection, error: partialCollectionError } = await a.client.rpc(
    "record_customer_payment",
    {
      p_vendor_id: a.vendor.id,
      p_customer_id: settlementCustomer?.id,
      p_customer_name: `Settlement Customer ${stamp}`,
      p_allocations: [{ sale_id: openSaleOne?.id, amount: 40000 }],
      p_payment_method: "Cash",
      p_account_id: settlementAccountId,
      p_reference: "PARTIAL-1",
      p_idempotency_key: partialKey,
    },
  );
  check("partial customer collection succeeds", !partialCollectionError, partialCollectionError);
  check(
    "partial collection reports the amount received",
    Number((partialCollection as { total?: number } | null)?.total) === 40000,
    partialCollection,
  );

  const { data: afterPartialSaleOne } = await a.client
    .from("sales")
    .select("paid_amount,due_amount,status")
    .eq("id", openSaleOne?.id)
    .single();
  check(
    "partial collection updates the sale balance",
    Number(afterPartialSaleOne?.paid_amount) === 40000 &&
      Number(afterPartialSaleOne?.due_amount) === 60000 &&
      afterPartialSaleOne?.status === "credit",
    afterPartialSaleOne,
  );

  const balanceAfterPartialCollection = await accountBalance(settlementAccountId);
  check(
    "customer collection increases the receiving account",
    balanceAfterPartialCollection === balanceBeforeCollections + 40000,
    { balanceAfterPartialCollection, balanceBeforeCollections },
  );

  const { data: duplicateCollection, error: duplicateCollectionError } = await a.client.rpc(
    "record_customer_payment",
    {
      p_vendor_id: a.vendor.id,
      p_customer_id: settlementCustomer?.id,
      p_customer_name: `Settlement Customer ${stamp}`,
      p_allocations: [{ sale_id: openSaleOne?.id, amount: 40000 }],
      p_payment_method: "Cash",
      p_account_id: settlementAccountId,
      p_reference: "PARTIAL-1",
      p_idempotency_key: partialKey,
    },
  );
  check(
    "retried customer collection returns the original payment",
    !duplicateCollectionError &&
      (duplicateCollection as { duplicate?: boolean } | null)?.duplicate === true,
    duplicateCollectionError,
  );
  check(
    "retried customer collection does not move money twice",
    (await accountBalance(settlementAccountId)) === balanceAfterPartialCollection,
  );

  const { data: settlementOverview, error: settlementOverviewError } = await a.client.rpc(
    "vendor_settlements_overview",
    { p_vendor_id: a.vendor.id, p_history_limit: 100 },
  );
  const collectionRows =
    ((settlementOverview as { customer_collections?: { customer_id: string; outstanding: number; sale_count: number }[] } | null)
      ?.customer_collections ?? []);
  const customerCollection = collectionRows.find((row) => row.customer_id === settlementCustomer?.id);
  check(
    "customer collections list the outstanding balance",
    !settlementOverviewError &&
      Number(customerCollection?.outstanding) === 120000 &&
      Number(customerCollection?.sale_count) === 2,
    { settlementOverviewError, customerCollection },
  );

  const { data: multipleCollection, error: multipleCollectionError } = await a.client.rpc(
    "record_customer_payment",
    {
      p_vendor_id: a.vendor.id,
      p_customer_id: settlementCustomer?.id,
      p_customer_name: `Settlement Customer ${stamp}`,
      p_allocations: [
        { sale_id: openSaleOne?.id, amount: 60000 },
        { sale_id: openSaleTwo?.id, amount: 60000 },
      ],
      p_payment_method: "MTN MoMo",
      p_account_id: settlementAccountId,
      p_reference: "FULL-MULTI-1",
      p_idempotency_key: `customer-full-${stamp}`,
    },
  );
  check("multiple-sale customer collection succeeds", !multipleCollectionError, multipleCollectionError);
  check(
    "multiple collection reports the combined total",
    Number((multipleCollection as { total?: number } | null)?.total) === 120000,
    multipleCollection,
  );

  const { data: settledSaleRows } = await a.client
    .from("sales")
    .select("id,paid_amount,due_amount,status")
    .in("id", [openSaleOne?.id, openSaleTwo?.id]);
  const settledSaleOne = (settledSaleRows ?? []).find((row) => row.id === openSaleOne?.id);
  const settledSaleTwo = (settledSaleRows ?? []).find((row) => row.id === openSaleTwo?.id);
  check(
    "full settlement closes every selected sale",
    Number(settledSaleOne?.paid_amount) === 100000 &&
      Number(settledSaleTwo?.paid_amount) === 60000 &&
      (settledSaleRows ?? []).every(
        (row) => Number(row.due_amount) === 0 && row.status === "paid",
      ),
    settledSaleRows,
  );
  check(
    "multiple collection increases the account by the combined total",
    (await accountBalance(settlementAccountId)) === balanceAfterPartialCollection + 120000,
  );

  const salesAfterSettlement = (await a.client.from("sales").select("id").eq("vendor_id", a.vendor.id))
    .data;
  check(
    "customer collection does not create a new sale",
    (salesAfterSettlement?.length ?? 0) === salesCountBefore,
    { before: salesCountBefore, after: salesAfterSettlement?.length ?? 0 },
  );

  // Supplier payments.
  const { data: supplierAccount, error: supplierAccountError } = await a.client.rpc(
    "create_financial_account",
    {
      p_vendor_id: a.vendor.id,
      p_name: `Supplier Payment Account ${stamp}`,
      p_kind: "bank",
      p_opening_balance: 100000,
    },
  );
  const supplierAccountId = (supplierAccount as { id?: string } | null)?.id;
  check(
    "supplier payment account created",
    !supplierAccountError && Boolean(supplierAccountId),
    supplierAccountError,
  );

  const creditPurchaseOne = await a.client.rpc("record_stock_purchase", {
    p_vendor_id: a.vendor.id,
    p_items: [{ product_id: purchaseProduct?.id, qty: 2, unit_cost: 10000 }],
    p_account_id: null,
    p_amount_paid: 0,
    p_supplier_name: `Settlement Supplier ${stamp}`,
    p_idempotency_key: `settlement-purchase-1-${stamp}`,
  });
  const creditPurchaseTwo = await a.client.rpc("record_stock_purchase", {
    p_vendor_id: a.vendor.id,
    p_items: [{ product_id: purchaseProduct?.id, qty: 3, unit_cost: 10000 }],
    p_account_id: null,
    p_amount_paid: 0,
    p_supplier_name: `Settlement Supplier ${stamp}`,
    p_idempotency_key: `settlement-purchase-2-${stamp}`,
  });
  check(
    "two outstanding supplier purchases created",
    !creditPurchaseOne.error && !creditPurchaseTwo.error,
    creditPurchaseOne.error ?? creditPurchaseTwo.error,
  );
  const creditPurchaseOneId = (creditPurchaseOne.data as { purchase_id?: string } | null)?.purchase_id;
  const creditPurchaseTwoId = (creditPurchaseTwo.data as { purchase_id?: string } | null)?.purchase_id;

  const { data: stockBeforeSupplierPayment } = await a.client
    .from("products")
    .select("stock")
    .eq("id", purchaseProduct?.id)
    .single();

  const supplierBalanceBefore = await accountBalance(supplierAccountId);
  const { data: partialSupplierPayment, error: partialSupplierError } = await a.client.rpc(
    "record_supplier_payment",
    {
      p_vendor_id: a.vendor.id,
      p_supplier_name: `Settlement Supplier ${stamp}`,
      p_allocations: [{ purchase_id: creditPurchaseOneId, amount: 5000 }],
      p_account_id: supplierAccountId,
      p_reference: "SUP-PARTIAL-1",
      p_idempotency_key: `supplier-partial-${stamp}`,
    },
  );
  check("partial supplier payment succeeds", !partialSupplierError, partialSupplierError);
  check(
    "partial supplier payment reports the amount paid",
    Number((partialSupplierPayment as { total?: number } | null)?.total) === 5000,
    partialSupplierPayment,
  );

  const { data: afterPartialPurchase } = await a.client
    .from("purchases")
    .select("paid_amount,due_amount")
    .eq("id", creditPurchaseOneId)
    .single();
  check(
    "partial supplier payment updates the purchase balance",
    Number(afterPartialPurchase?.paid_amount) === 5000 &&
      Number(afterPartialPurchase?.due_amount) === 15000,
    afterPartialPurchase,
  );
  check(
    "supplier payment reduces the paying account",
    (await accountBalance(supplierAccountId)) === supplierBalanceBefore - 5000,
  );

  const { data: multipleSupplierPayment, error: multipleSupplierError } = await a.client.rpc(
    "record_supplier_payment",
    {
      p_vendor_id: a.vendor.id,
      p_supplier_name: `Settlement Supplier ${stamp}`,
      p_allocations: [
        { purchase_id: creditPurchaseOneId, amount: 15000 },
        { purchase_id: creditPurchaseTwoId, amount: 30000 },
      ],
      p_account_id: supplierAccountId,
      p_reference: "SUP-FULL-MULTI-1",
      p_idempotency_key: `supplier-full-${stamp}`,
    },
  );
  check("multiple-purchase supplier payment succeeds", !multipleSupplierError, multipleSupplierError);
  check(
    "multiple supplier payment reports the combined total",
    Number((multipleSupplierPayment as { total?: number } | null)?.total) === 45000,
    multipleSupplierPayment,
  );

  const { data: settledPurchases } = await a.client
    .from("purchases")
    .select("id,paid_amount,due_amount")
    .in("id", [creditPurchaseOneId, creditPurchaseTwoId]);
  const settledPurchaseOne = (settledPurchases ?? []).find((row) => row.id === creditPurchaseOneId);
  const settledPurchaseTwo = (settledPurchases ?? []).find((row) => row.id === creditPurchaseTwoId);
  check(
    "full supplier settlement closes every selected purchase",
    Number(settledPurchaseOne?.paid_amount) === 20000 &&
      Number(settledPurchaseTwo?.paid_amount) === 30000 &&
      (settledPurchases ?? []).every((row) => Number(row.due_amount) === 0),
    settledPurchases,
  );
  check(
    "supplier payments reduce the account by the combined total",
    (await accountBalance(supplierAccountId)) === supplierBalanceBefore - 5000 - 45000,
  );

  const { data: stockAfterSupplierPayment } = await a.client
    .from("products")
    .select("stock")
    .eq("id", purchaseProduct?.id)
    .single();
  check(
    "supplier payment does not change stock",
    stockAfterSupplierPayment?.stock === stockBeforeSupplierPayment?.stock,
    { before: stockBeforeSupplierPayment?.stock, after: stockAfterSupplierPayment?.stock },
  );
  const expensesAfterSettlement = (
    await a.client
      .from("finance_entries")
      .select("id")
      .eq("vendor_id", a.vendor.id)
      .eq("type", "expense")
  ).data;
  check(
    "settlements do not record a stock purchase expense again",
    (expensesAfterSettlement?.length ?? 0) === expenseCountBefore,
    { before: expenseCountBefore, after: expensesAfterSettlement?.length ?? 0 },
  );

  const { data: finalSettlementOverview } = await a.client.rpc("vendor_settlements_overview", {
    p_vendor_id: a.vendor.id,
    p_history_limit: 100,
  });
  const finalCollections =
    ((finalSettlementOverview as { customer_collections?: { customer_id: string }[] } | null)
      ?.customer_collections ?? []);
  const finalPayables =
    ((finalSettlementOverview as { supplier_payables?: { supplier_name: string }[] } | null)
      ?.supplier_payables ?? []);
  check(
    "settled customers and suppliers leave the outstanding lists",
    !finalCollections.some((row) => row.customer_id === settlementCustomer?.id) &&
      !finalPayables.some((row) => row.supplier_name === `Settlement Supplier ${stamp}`),
    { finalCollections, finalPayables },
  );
  const historyRows =
    ((finalSettlementOverview as { history?: { settlement_type: string; party_name: string }[] } | null)
      ?.history ?? []);
  check(
    "settlement history keeps both transaction types",
    historyRows.some(
      (row) => row.settlement_type === "customer_collection" && row.party_name === `Settlement Customer ${stamp}`,
    ) &&
      historyRows.some(
        (row) => row.settlement_type === "supplier_payment" && row.party_name === `Settlement Supplier ${stamp}`,
      ),
    historyRows,
  );
}

main()
  .catch((error) => {
    failed++;
    console.error("FATAL", error);
  })
  .finally(async () => {
    for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
  });
