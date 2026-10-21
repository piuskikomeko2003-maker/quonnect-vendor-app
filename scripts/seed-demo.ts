/**
 * Dev-only demo data generator. Never imported by the app.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts --email demo@quonnect.test
 *   npx tsx scripts/seed-demo.ts --email demo@quonnect.test --reset
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (or the environment). Never commit the service-role key.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

try {
  const parsed = config({ path: ".env.local" }).parsed ?? {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env.local is optional in CI.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const args = process.argv.slice(2);
const email = args.includes("--email")
  ? args[args.indexOf("--email") + 1]
  : "demo@quonnect.test";
const reset = args.includes("--reset");
const password = "demo1234";

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

function key(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return key(date);
}
function today(): string {
  return key(new Date());
}
function monthsAgo(amount: number): Date {
  const date = new Date();
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - amount, 1, 12));
}

let seed = 12345;
function random(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function round500(value: number): number {
  return Math.round(value / 500) * 500;
}

const PRODUCTS = [
  { name: "Kitenge Dress", category: "Dresses", price: 65000, cost: 40000, stock: 12, colors: ["Blue", "Red", "Yellow"], sizes: ["S", "M", "L", "XL"], description: "Handmade kitenge, fitted waist, machine washable." },
  { name: "Leather Sandals", category: "Shoes", price: 35000, cost: 20000, stock: 3, colors: ["Brown", "Black"], sizes: ["38", "39", "40", "41", "42"], description: "Genuine leather with a cushioned sole." },
  { name: "Woven Basket", category: "Other", price: 25000, cost: 12000, stock: 20, colors: ["Natural"], sizes: ["One size"], description: "Hand-woven sisal basket." },
  { name: "Shea Body Butter", category: "Other", price: 18000, cost: 9000, stock: 2, colors: [], sizes: ["One size"], description: "Raw shea, unscented, 250g." },
  { name: "Denim Jeans", category: "Trousers & jeans", price: 27000, cost: 16000, stock: 9, colors: ["Blue", "Black"], sizes: ["30", "32", "34", "36"], description: "Stretch denim, straight cut." },
];

async function main() {
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = users.users.find((entry) => entry.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        owner_name: "Amina Nakato",
        business_name: "Amina Fashions",
        category: "Fashion & clothing",
        region: "Owino Market, Kampala",
        phone: "+256 772 000 111",
        motto: "Quality styles, fair prices",
        instagram: "aminafashions",
      },
    });
    if (error || !data.user) throw error ?? new Error("Could not create demo user");
    user = data.user;
  }

  const { data: vendor, error: vendorError } = await admin
    .from("vendors")
    .upsert(
      {
        user_id: user.id,
        owner_name: "Amina Nakato",
        business_name: "Amina Fashions",
        category: "Fashion & clothing",
        region: "Owino Market, Kampala",
        phone: "+256 772 000 111",
        email,
        motto: "Quality styles, fair prices",
        instagram: "aminafashions",
        facebook: "AminaFashions",
        tiktok: "aminafashions",
        whatsapp: "+256772000111",
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (vendorError || !vendor) throw vendorError ?? new Error("Could not create vendor");

  await admin.from("stalls").upsert(
    { vendor_id: vendor.id, name: "Amina Fashions", tagline: "Quality styles, fair prices", accent_color: "#0F8A4D" },
    { onConflict: "vendor_id" },
  );

  if (reset) {
    await admin.from("sale_items").delete().eq("vendor_id", vendor.id);
    await admin.from("sales").delete().eq("vendor_id", vendor.id);
    await admin.from("stock_movements").delete().eq("vendor_id", vendor.id);
    await admin.from("products").delete().eq("vendor_id", vendor.id);
    await admin.from("finance_entries").delete().eq("vendor_id", vendor.id);
    await admin.from("budgets").delete().eq("vendor_id", vendor.id);
  }

  const { data: existing } = await admin
    .from("products")
    .select("id")
    .eq("vendor_id", vendor.id)
    .limit(1);

  if (!existing?.length) {
    const { data: products, error } = await admin
      .from("products")
      .insert(
        PRODUCTS.map((product, index) => ({
          vendor_id: vendor.id,
          ...product,
          discount_pct: index === 1 ? 10 : 0,
          is_active: index !== 3,
        })),
      )
      .select("*");
    if (error) throw error;

    const start = monthsAgo(8);
    const end = today();
    let cursor = key(start);
    let order = 1;
    while (cursor < end) {
      const date = new Date(`${cursor}T12:00:00Z`);
      const day = date.getUTCDate();
      const weekend = [0, 6].includes(date.getUTCDay());
      if (random() < 0.85) {
        const total = round500((68000 + random() * 90000) * (weekend ? 1.3 : 1));
        const profit = round500(total * (0.3 + random() * 0.12));
        const reduction = random() < 0.25 ? round500(total * 0.04) : 0;
        const { data: sale } = await admin
          .from("sales")
          .insert({
            vendor_id: vendor.id,
            order_no: `S-DEMO-${String(order++).padStart(4, "0")}`,
            total,
            subtotal: total,
            paid_amount: total,
            profit,
            price_reduction: reduction,
            payment_method: "Cash",
            sale_date: cursor,
            status: "completed",
          })
          .select("id")
          .single();
        if (sale && products?.length) {
          const product = products[Math.floor(random() * products.length)];
          const qty = 1 + Math.floor(random() * 2);
          await admin.from("sale_items").insert({
            sale_id: sale.id,
            vendor_id: vendor.id,
            product_id: product.id,
            product_name: product.name,
            quantity: qty,
            unit_price: product.price,
            sold_price: product.price,
            listed_price: product.price,
            unit_cost: product.cost,
            total: product.price * qty,
            profit: (product.price - product.cost) * qty,
          });
        }
      }

      const expense = async (category: string, amount: number, note: string) => {
        await admin.from("finance_entries").insert({
          vendor_id: vendor.id,
          type: "expense",
          category,
          amount: round500(amount),
          source: "manual",
          entry_date: cursor,
          notes: note,
        });
      };
      if (day === 3) await expense("Stall fee", 92000, "Market day fee");
      if (day === 5 || day === 20) await expense("Stock purchase", 320000, "Restock");
      if (day === 8) await expense("Airtime/Data", 7000, "");
      if (day === 10 || day === 17) await expense("Transport", 18000, "");
      if (day === 12) await expense("Packaging", 14000, "Bags");
      if (day === 14 && random() < 0.5) {
        await admin.from("finance_entries").insert({
          vendor_id: vendor.id,
          type: "income",
          category: "Custom tailoring",
          amount: round500(40000 + random() * 40000),
          source: "manual",
          entry_date: cursor,
        });
      }
      cursor = addDays(cursor, 1);
    }

    await admin.from("budgets").insert([
      { vendor_id: vendor.id, category: "Stock purchase", monthly_limit: 1200000 },
      { vendor_id: vendor.id, category: "Transport", monthly_limit: 40000 },
      { vendor_id: vendor.id, category: "Stall fee", monthly_limit: 120000 },
      { vendor_id: vendor.id, category: "Packaging", monthly_limit: 30000 },
      { vendor_id: vendor.id, category: "Airtime/Data", monthly_limit: 20000 },
    ]);
  }

  console.log(`Demo data ready.\nEmail: ${email}\nPassword: ${password}\nVendor: ${vendor.id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
