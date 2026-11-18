"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StallScreen } from "@/components/screens/StallScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { loadProductCategories, loadProducts } from "@/lib/data";
import { useAppData, usePageTitle } from "@/lib/query";

function StallPageContent() {
  usePageTitle("Online stall · Quonnect Vendor");
  const params = useSearchParams();
  const rawCustomise = params.get("customise");
  const { supabase, vendor, stall } = useVendor();

  const { data, error } = useAppData(vendor.id, () =>
    Promise.all([
      loadProducts(supabase, vendor.id),
      loadProductCategories(supabase, vendor.id),
    ]),
  );

  return (
    <>
      <h1 className="page-title">Online stall</h1>
      <p className="page-subtitle">Live on Quonnect Online Market</p>
      {error ? (
        <p className="page-subtitle">Could not load your stall: {error}</p>
      ) : data ? (
        <StallScreen
          data={{ vendor, stall, products: data[0] }}
          customCategories={data[1]}
          initialCustomise={rawCustomise === "1"}
        />
      ) : (
        <PageSkeleton rows={4} />
      )}
    </>
  );
}

export default function StallPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <StallPageContent />
    </Suspense>
  );
}
