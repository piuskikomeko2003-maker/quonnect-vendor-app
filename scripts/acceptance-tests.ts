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
