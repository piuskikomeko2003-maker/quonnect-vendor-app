import { MoneyScreen } from "@/components/screens/MoneyScreen";
import { requireVendor } from "@/lib/auth";
import { loadMoney } from "@/lib/data";

export const metadata = { title: "Money · Quonnect Vendor" };

export default async function MoneyPage() {
  const { supabase, vendor } = await requireVendor();
  const data = await loadMoney(supabase, vendor.id);
  return <MoneyScreen data={data} />;
}
