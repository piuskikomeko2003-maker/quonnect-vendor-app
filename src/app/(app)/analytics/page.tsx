"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AnalyticsScreen } from "@/components/screens/AnalyticsScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { loadAnalytics } from "@/lib/data";
import { parseAnalyticsParams } from "@/lib/analytics-params";
import { useAppData, usePageTitle } from "@/lib/query";

function AnalyticsPageContent() {
  usePageTitle("Analytics · Quonnect Vendor");
  const params = useSearchParams();
  const { supabase, vendor } = useVendor();
  const { range, group, metrics, months, cmp, start, end } = parseAnalyticsParams(params);

  const key = [vendor.id, start, end, group, months].join("|");
  const { data, error } = useAppData(key, () =>
    loadAnalytics(supabase, vendor.id, start, end, group, months),
  );

  return (
    <>
      <h1 className="page-title">Analytics</h1>
      <p className="page-subtitle">See how your business is growing</p>
      {error ? (
        <p className="page-subtitle">Could not load analytics: {error}</p>
      ) : data ? (
        <AnalyticsScreen
          data={data}
          range={range}
          group={group}
          metrics={metrics}
          months={months}
          cmp={cmp}
        />
      ) : (
        <PageSkeleton rows={4} />
      )}
    </>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <AnalyticsPageContent />
    </Suspense>
  );
}
