import { SellScreen } from "@/components/screens/SellScreen";
import { requireVendor } from "@/lib/auth";
import { receiptBusiness } from "@/lib/business";
import { loadSell } from "@/lib/data";

export const metadata = { title: "Sell · Quonnect Vendor" };

export default async function SellPage() {
  const { supabase, vendor, stall } = await requireVendor();
  const data = await loadSell(supabase, vendor.id);

  return (
    <SellScreen
      products={data.products}
      recentSales={data.recentSales}
      business={receiptBusiness(vendor, stall)}
    />
  );
}
