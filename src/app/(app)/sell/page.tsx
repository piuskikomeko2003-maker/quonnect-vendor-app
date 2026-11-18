"use client";

import { SellScreen } from "@/components/screens/SellScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { receiptBusiness } from "@/lib/business";
import { loadSell } from "@/lib/data";
import { useAppData, usePageTitle } from "@/lib/query";

export default function SellPage() {
  usePageTitle("Sell · Quonnect Vendor");
  const { supabase, vendor, stall } = useVendor();
  const { data, error } = useAppData(vendor.id, () => loadSell(supabase, vendor.id));

  return (
    <>
      <h1 className="page-title">Record a sale</h1>
      <p className="page-subtitle">Tap products to add to the cart</p>
      {error ? (
        <p className="page-subtitle">Could not load your products: {error}</p>
      ) : data ? (
        <SellScreen
          products={data.products}
          recentSales={data.recentSales}
          business={receiptBusiness(vendor, stall)}
        />
      ) : (
        <PageSkeleton rows={4} />
      )}
    </>
  );
}
