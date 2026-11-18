"use client";

import { AccountsScreen } from "@/components/screens/AccountsScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { loadAccounts } from "@/lib/data";
import { useAppData, usePageTitle } from "@/lib/query";

export default function AccountsPage() {
  usePageTitle("Business accounts · Quonnect Vendor");
  const { supabase, vendor } = useVendor();
  const { data, error } = useAppData(`accounts|${vendor.id}`, () =>
    loadAccounts(supabase, vendor.id),
  );

  return (
    <>
      <h1 className="page-title">Business accounts</h1>
      <p className="page-subtitle">Manage where your business money is held</p>
      {error ? (
        <p className="page-subtitle">Could not load your business accounts: {error}</p>
      ) : data ? (
        <AccountsScreen data={data} />
      ) : (
        <PageSkeleton rows={4} />
      )}
    </>
  );
}
