import { MoneyScreen } from "@/components/screens/MoneyScreen";
import { requireVendor } from "@/lib/auth";
import { loadMoney } from "@/lib/data";

export const metadata = { title: "Money · Quonnect Vendor" };

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab = rawTab === "inc" || rawTab === "bud" ? rawTab : "exp";
  const { supabase, vendor } = await requireVendor();
  const data = await loadMoney(supabase, vendor.id);
  return <MoneyScreen data={data} initialTab={initialTab} />;
}
