"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrdersScreen, type OrderTab } from "@/components/screens/OrdersScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { loadHome } from "@/lib/data";
import { addDays, currentMonthKey, todayKey } from "@/lib/format";
import { useAppData, usePageTitle } from "@/lib/query";

function OrdersPageContent() {
  usePageTitle("Orders · Quonnect Vendor");
  const params = useSearchParams();
  const rawTab = params.get("tab");
  const initialTab: OrderTab = rawTab === "bookings" || rawTab === "messages" ? rawTab : "sales";
  const { supabase, vendor } = useVendor();
  const today = todayKey();
  const month = currentMonthKey();
  const from = addDays(today, -29);

  const { data, error } = useAppData([vendor.id, month, from, today].join("|"), () =>
    loadHome(supabase, vendor.id, month, from, today),
  );
  const orders = data?.transactions.filter((item) => item.kind === "sale") ?? [];

  return (
    <>
      <h1 className="page-title">Orders</h1>
      <p className="page-subtitle">Sales, bookings and customer messages</p>
      {error ? (
        <p className="page-subtitle">Could not load orders: {error}</p>
      ) : data ? (
        <OrdersScreen orders={orders} initialTab={initialTab} />
      ) : (
        <PageSkeleton rows={4} />
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <OrdersPageContent />
    </Suspense>
  );
}
