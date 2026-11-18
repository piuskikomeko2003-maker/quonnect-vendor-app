"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { loadDashboard, loadProducts } from "@/lib/data";
import { hasFeature } from "@/lib/features";
import { todayKey } from "@/lib/format";
import { useAppData, usePageTitle } from "@/lib/query";
import { isReportingPeriod, resolveReportingPeriod } from "@/lib/reporting-period";

function HomePageContent() {
  usePageTitle("Home · Quonnect Vendor");
  const params = useSearchParams();
  const { supabase, vendor } = useVendor();
  const today = todayKey();
  const rawPeriod = params.get("period");
  const period = isReportingPeriod(rawPeriod) ? rawPeriod : "daily";
  const { from, to } = resolveReportingPeriod(
    period,
    params.get("from"),
    params.get("to"),
    today,
    vendor.month_start_day ?? 1,
  );

  const key = [vendor.id, period, from, to].join("|");
  const { data, error } = useAppData(key, () =>
    Promise.all([
      loadDashboard(supabase, vendor.id, from, to),
      loadProducts(supabase, vendor.id),
    ]),
  );

  if (error) return <p className="page-subtitle">Could not load your home screen: {error}</p>;
  if (!data) return <PageSkeleton rows={4} />;

  return (
    <HomeScreen
      data={data[0]}
      products={data[1] ?? []}
      period={period}
      today={today}
      monthStartDay={vendor.month_start_day ?? 1}
      customersEnabled={hasFeature(vendor, "customers")}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <HomePageContent />
    </Suspense>
  );
}
