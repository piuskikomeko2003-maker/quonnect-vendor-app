import { ensureVendorProfile } from "@/lib/vendor";
import { createClient } from "@/lib/supabase/server";

export interface SetupStatus {
  email: string | null;
  missing: string[];
  repairError: string | null;
  repaired: boolean;
}

export async function getSetupStatus(): Promise<SetupStatus | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const checks: { label: string; run: () => PromiseLike<{ error: { code?: string; message: string } | null }> }[] = [
    {
      label: "vendors profile columns (owner_name, motto, phone2, socials)",
      run: () => supabase.from("vendors").select("owner_name,motto,phone2,instagram,facebook,tiktok,whatsapp").limit(1),
    },
    { label: "stalls table", run: () => supabase.from("stalls").select("id,vendor_id,name,accent_color").limit(1) },
    { label: "sales table", run: () => supabase.from("sales").select("id,price_reduction,customer_phone").limit(1) },
    { label: "sale_items price snapshots", run: () => supabase.from("sale_items").select("listed_price,sold_price").limit(1) },
    { label: "stock_movements table", run: () => supabase.from("stock_movements").select("id,delta,reason").limit(1) },
    { label: "budgets table", run: () => supabase.from("budgets").select("id,category,monthly_limit").limit(1) },
    {
      label: "expense frequency column (daily/monthly)",
      run: () => supabase.from("finance_entries").select("id,frequency").limit(1),
    },
    {
      label: "finance_categories table",
      run: () => supabase.from("finance_categories").select("id,type,name").limit(1),
    },
  ];

  const missing: string[] = [];
  await Promise.all(
    checks.map(async (check) => {
      const { error } = await check.run();
      if (error && ["PGRST205", "42P01", "42703", "PGRST204"].includes(error.code ?? "")) {
        missing.push(check.label);
      }
    }),
  );

  const repaired = await ensureVendorProfile(supabase, user);

  return {
    email: user.email ?? null,
    missing: missing.sort(),
    repairError: repaired.error ?? null,
    repaired: Boolean(repaired.vendor && repaired.stall),
  };
}
