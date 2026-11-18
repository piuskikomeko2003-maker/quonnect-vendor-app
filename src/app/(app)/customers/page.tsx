"use client";

import { CustomersScreen } from "@/components/screens/CustomersScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { loadCustomers } from "@/lib/data";
import { useAppData, usePageTitle } from "@/lib/query";

export default function CustomersPage() {
  usePageTitle("Customers · Quonnect Vendor");
  const { supabase, vendor } = useVendor();
  const { data, error } = useAppData(vendor.id, () => loadCustomers(supabase, vendor.id));

  return (
    <>
      <h1 className="page-title">Customers</h1>
      <p className="page-subtitle">Everyone who has bought from you</p>
      {error ? (
        <p className="page-subtitle">Could not load customers: {error}</p>
      ) : data ? (
        <CustomersScreen customers={data} />
      ) : (
        <PageSkeleton rows={4} />
      )}
    </>
  );
}
