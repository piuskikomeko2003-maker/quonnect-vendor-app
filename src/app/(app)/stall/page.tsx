import { StallScreen } from "@/components/screens/StallScreen";
import { requireVendor } from "@/lib/auth";
import { loadProducts } from "@/lib/data";

export const metadata = { title: "Stall · Quonnect Vendor" };

export default async function StallPage() {
  const { supabase, vendor, stall } = await requireVendor();
  const products = await loadProducts(supabase, vendor.id);

  return <StallScreen data={{ vendor, stall, products }} />;
}
