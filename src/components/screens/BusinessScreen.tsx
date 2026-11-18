"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnalyticsScreen } from "@/components/screens/AnalyticsScreen";
import { CustomersScreen } from "@/components/screens/CustomersScreen";
import { MoneyScreen } from "@/components/screens/MoneyScreen";
import type { AnalyticsRange, GroupBy, Metric } from "@/lib/constants";
import type { AnalyticsData, MoneyData } from "@/lib/types";
import type { Customer } from "@/types/app-db";

type BusinessTab = "money" | "analytics" | "customers";

interface BusinessScreenProps {
  money: MoneyData;
  analytics: AnalyticsData;
  customers?: Customer[];
  customersEnabled?: boolean;
  analyticsEnabled?: boolean;
  initialTab?: BusinessTab;
  initialAdd?: "expense" | "income" | "budget" | null;
  range?: AnalyticsRange;
  group?: GroupBy;
  metrics?: Metric[];
  months?: number;
  cmp?: "item" | "time";
  basePath?: string;
}

export function BusinessScreen({
  money,
  analytics,
  customers = [],
  customersEnabled = true,
  analyticsEnabled = true,
  initialTab = "money",
  initialAdd = null,
  range = "30d",
  group = "day",
  metrics = ["sales", "expenses", "profit"],
  months = 12,
  cmp = "item",
  basePath = "/business",
}: BusinessScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");

  const tabs: [BusinessTab, string][] = [["money", "Income & expenses"]];
  if (analyticsEnabled) tabs.push(["analytics", "Analytics"]);
  if (customersEnabled) tabs.push(["customers", "Customers"]);

  const wantedTab: BusinessTab =
    requestedTab === "analytics" || requestedTab === "customers" || requestedTab === "money"
      ? requestedTab
      : initialTab;
  const activeTab = tabs.some(([key]) => key === wantedTab) ? wantedTab : "money";

  function selectTab(next: BusinessTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    params.delete("add");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const moneyInitialTab =
    initialAdd === "income"
      ? "inc"
      : initialAdd === "budget"
        ? "bud"
        : initialAdd === "expense"
          ? "exp"
          : undefined;

  return (
    <>
      <div className="seg" role="tablist" aria-label="Business sections">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={activeTab === key ? "on" : ""}
            onClick={() => selectTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "money" ? (
        <MoneyScreen data={money} initialTab={moneyInitialTab} initialAdd={initialAdd} />
      ) : null}

      {activeTab === "analytics" ? (
        <AnalyticsScreen
          data={analytics}
          range={range}
          group={group}
          metrics={metrics}
          months={months}
          cmp={cmp}
          basePath={basePath}
          preserveParams={{ tab: "analytics" }}
        />
      ) : null}

      {activeTab === "customers" ? <CustomersScreen customers={customers} /> : null}
    </>
  );
}
