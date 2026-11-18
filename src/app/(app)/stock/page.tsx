"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StockScreen } from "@/components/screens/StockScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { loadAccounts, loadProductCategories, loadProducts, loadPurchases } from "@/lib/data";
import { useAppData, usePageTitle } from "@/lib/query";

function StockPageContent() {
  usePageTitle("My stock · Quonnect Vendor");
  const params = useSearchParams();
  const rawAdd = params.get("add");
  const rawRestock = params.get("restock");
  const { supabase, vendor } = useVendor();

  const { data, error } = useAppData(vendor.id, () =>
    Promise.all([
      loadProducts(supabase, vendor.id),
      loadProductCategories(supabase, vendor.id),
      loadAccounts(supabase, vendor.id),
      loadPurchases(supabase, vendor.id),
    ]),
  );

  return (
    <>
      <h1 className="page-title">My stock</h1>
      <p className="page-subtitle">Register and monitor your items</p>
      {error ? (
        <p className="page-subtitle">Could not load your stock: {error}</p>
      ) : data ? (
        <StockScreen
          vendorId={vendor.id}
          products={data[0]}
          customCategories={data[1]}
          accounts={data[2]}
          purchases={data[3]}
          initialAdd={rawAdd === "1"}
          initialRestockProductId={rawRestock}
        />
      ) : (
        <PageSkeleton rows={4} />
      )}
    </>
  );
}

export default function StockPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <StockPageContent />
    </Suspense>
  );
}
