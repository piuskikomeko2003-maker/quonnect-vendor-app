"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MoneyScreen } from "@/components/screens/MoneyScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useVendor } from "@/components/app/VendorProvider";
import { loadMoney } from "@/lib/data";
import { useAppData, usePageTitle } from "@/lib/query";

function MoneyPageContent() {
  usePageTitle("Money · Quonnect Vendor");
  const params = useSearchParams();
  const rawTab = params.get("tab");
  const rawAdd = params.get("add");
  const initialAdd =
    rawAdd === "expense" || rawAdd === "income" || rawAdd === "budget" ? rawAdd : null;
  const initialTab =
    rawTab === "accounts" || rawTab === "exp" || rawTab === "inc" || rawTab === "bud" || rawTab === "tx"
      ? rawTab
      : initialAdd === "expense"
        ? "exp"
        : initialAdd === "income"
          ? "inc"
          : initialAdd === "budget"
            ? "bud"
            : "overview";
  const { supabase, vendor } = useVendor();
  const { data, error } = useAppData(vendor.id, () => loadMoney(supabase, vendor.id));

  return (
    <>
      <h1 className="page-title">Money</h1>
      <p className="page-subtitle">Expenses, income and budgets</p>
      {error ? (
        <p className="page-subtitle">Could not load your money page: {error}</p>
      ) : data ? (
        <MoneyScreen data={data} initialTab={initialTab} initialAdd={initialAdd} />
      ) : (
        <PageSkeleton rows={4} />
      )}
    </>
  );
}

export default function MoneyPage() {
  return (
    <Suspense fallback={<PageSkeleton rows={4} />}>
      <MoneyPageContent />
    </Suspense>
  );
}
