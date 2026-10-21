import { StockScreen } from "@/components/screens/StockScreen";
import { requireVendor } from "@/lib/auth";
import { loadProducts } from "@/lib/data";

export const metadata = { title: "Stock · Quonnect Vendor" };

export default async function StockPage() {
  const { supabase, vendor } = await requireVendor();
  const products = await loadProducts(supabase, vendor.id);

  return <StockScreen vendorId={vendor.id} products={products} />;
}
