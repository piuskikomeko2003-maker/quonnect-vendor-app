"use client";

import { SettlementsScreen } from "@/components/screens/SettlementsScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { loadSettlements } from "@/lib/data";
import { useAppData, usePageTitle } from "@/lib/query";

export default function SettlementsPage() {
  usePageTitle("Settlements · Quonnect Vendor");
  const { supabase, vendor } = useVendor();
  const { data, error } = useAppData(`settlements|${vendor.id}`, () =>
    loadSettlements(supabase, vendor.id),
  );

  return (
    <>
      <h1 className="page-title">Settlements</h1>
      <p className="page-subtitle">Collect customer balances and pay suppliers</p>
      {error ? (
        <p className="page-subtitle">Could not load settlements: {error}</p>
      ) : data ? (
        <SettlementsScreen data={data} />
      ) : (
        <PageSkeleton rows={4} />
      )}
    </>
  );
}
