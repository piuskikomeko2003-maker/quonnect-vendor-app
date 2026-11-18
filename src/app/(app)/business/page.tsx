"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BusinessScreen } from "@/components/screens/BusinessScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { loadAnalytics, loadCustomers, loadMoney } from "@/lib/data";
import { parseAnalyticsParams } from "@/lib/analytics-params";
import { hasFeature } from "@/lib/features";
import { useAppData, usePageTitle } from "@/lib/query";
import type { Customer } from "@/types/app-db";

function BusinessPageContent() {
  usePageTitle("Business · Quonnect Vendor");
  const params = useSearchParams();
  const rawTab = params.get("tab");
  const rawAdd = params.get("add");
  const { supabase, vendor } = useVendor();
  const analyticsParams = parseAnalyticsParams(params);
  const customersEnabled = hasFeature(vendor, "customers");
  const analyticsEnabled = hasFeature(vendor, "analytics");
  const initialTab =
    rawTab === "analytics" || rawTab === "customers" ? rawTab : "money";
  const initialAdd =
    rawAdd === "expense" || rawAdd === "income" || rawAdd === "budget" ? rawAdd : null;

  const key = [
    vendor.id,
    analyticsParams.start,
    analyticsParams.end,
    analyticsParams.group,
    analyticsParams.months,
    customersEnabled ? "customers" : "no-customers",
  ].join("|");

  const { data, error } = useAppData(key, () =>
    Promise.all([
      loadMoney(supabase, vendor.id),
      loadAnalytics(
        supabase,
        vendor.id,
        analyticsParams.start,
        analyticsParams.end,
        analyticsParams.group,
        analyticsParams.months,
      ),
      customersEnabled
        ? loadCustomers(supabase, vendor.id)
        : Promise.resolve<Customer[]>([]),
    ]),
  );

  return (
    <>
      <h1 className="page-title">Business</h1>
      <p className="page-subtitle">Money, analytics and customers in one place</p>
      {error ? (
        <p className="page-subtitle">Could not load your business: {error}</p>
      ) : data ? (
        <BusinessScreen
          money={data[0]}
          analytics={data[1]}
          customers={data[2]}
          customersEnabled={customersEnabled}
          analyticsEnabled={analyticsEnabled}
          initialTab={initialTab}
          initialAdd={initialAdd}
          range={analyticsParams.range}
          group={analyticsParams.group}
          metrics={analyticsParams.metrics}
          months={analyticsParams.months}
          cmp={analyticsParams.cmp}
        />
      ) : (
        <PageSkeleton rows={4} />
      )}
    </>
  );
}

export default function BusinessPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <BusinessPageContent />
    </Suspense>
  );
}
