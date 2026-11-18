import { notFound } from "next/navigation";
import { AccountsScreen } from "@/components/screens/AccountsScreen";
import { AnalyticsScreen } from "@/components/screens/AnalyticsScreen";
import { BusinessScreen } from "@/components/screens/BusinessScreen";
import { CustomersScreen } from "@/components/screens/CustomersScreen";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { MoneyScreen } from "@/components/screens/MoneyScreen";
import { OrdersScreen } from "@/components/screens/OrdersScreen";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { SellScreen } from "@/components/screens/SellScreen";
import { SettlementsScreen } from "@/components/screens/SettlementsScreen";
import { StallScreen } from "@/components/screens/StallScreen";
import { StockScreen } from "@/components/screens/StockScreen";
import { receiptBusiness } from "@/lib/business";
import { todayKey } from "@/lib/format";
import {
  isReportingPeriod,
  resolveReportingPeriod,
} from "@/lib/reporting-period";
import {
  previewAccounts,
  previewAnalytics,
  previewCustomers,
  previewDashboard,
  previewHome,
  previewMoney,
  previewProducts,
  previewPurchases,
  previewSell,
  previewSettlements,
  previewStall,
  previewStallData,
  previewVendor,
} from "@/lib/fixtures";

export function generateStaticParams() {
  return [
    "home",
    "orders",
    "business",
    "customers",
    "sell",
    "stock",
    "money",
    "analytics",
    "accounts",
    "settlements",
    "stall",
    "profile",
  ].map((screen) => ({ screen }));
}

/**
 * Dev-only visual QA harness. In production it 404s unless ALLOW_PREVIEW=1.
 * It uses the same client screens and fixtures, so it can be screenshotted
 * without a Supabase connection.
 */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PREVIEW !== "1") {
    notFound();
  }

  const { screen } = await params;
  const query = await searchParams;
  const one = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const business = receiptBusiness(previewVendor, previewStall);
  const today = todayKey();
  const orderTab = one(query.tab);
  const addParam = one(query.add);
  const rawPeriod = one(query.period);
  const previewPeriod = isReportingPeriod(rawPeriod) ? rawPeriod : "custom";
  const previewRange = resolveReportingPeriod(
    previewPeriod,
    one(query.from),
    one(query.to),
    today,
    1,
  );
  const previewDashboardData = {
    ...previewDashboard,
    period: { ...previewDashboard.period, from: previewRange.from, to: previewRange.to },
  };

  switch (screen) {
    case "home":
      return (
        <HomeScreen
          data={previewDashboardData}
          products={previewProducts}
          period={previewPeriod}
          today={today}
          basePath="/preview"
        />
      );
    case "orders":
      return (
        <>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">Sales, bookings and customer messages</p>
          <OrdersScreen
            orders={previewHome.transactions.filter((item) => item.kind === "sale")}
            initialTab={orderTab === "bookings" || orderTab === "messages" ? orderTab : "sales"}
          />
        </>
      );
    case "business":
      return (
        <>
          <h1 className="page-title">Business</h1>
          <p className="page-subtitle">Money, analytics and customers in one place</p>
          <BusinessScreen
            money={previewMoney}
            analytics={previewAnalytics}
            customers={previewCustomers}
            initialTab={
              orderTab === "analytics" || orderTab === "customers" ? orderTab : "money"
            }
            initialAdd={
              addParam === "expense" || addParam === "income" || addParam === "budget"
                ? addParam
                : null
            }
            basePath="/preview/business"
          />
        </>
      );
    case "customers":
      return (
        <>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Everyone who has bought from you</p>
          <CustomersScreen customers={previewCustomers} />
        </>
      );
    case "sell":
      return (
        <>
          <h1 className="page-title">Record a sale</h1>
          <p className="page-subtitle">Tap products to add to the cart</p>
          <SellScreen
            products={previewSell.products}
            recentSales={previewSell.recentSales}
            business={business}
          />
        </>
      );
    case "stock":
      return (
        <>
          <h1 className="page-title">My stock</h1>
          <p className="page-subtitle">Register and monitor your items</p>
          <StockScreen
            vendorId={previewVendor.id}
            products={previewProducts}
            accounts={previewAccounts}
            purchases={previewPurchases}
            initialAdd={addParam === "1"}
            initialRestockProductId={one(query.restock)}
          />
        </>
      );
    case "money":
      return (
        <>
          <h1 className="page-title">Money</h1>
          <p className="page-subtitle">Expenses, income and budgets</p>
          <MoneyScreen
            data={previewMoney}
            initialTab={orderTab === "inc" || orderTab === "bud" ? orderTab : "exp"}
            initialAdd={
              addParam === "expense" || addParam === "income" || addParam === "budget"
                ? addParam
                : null
            }
          />
        </>
      );
    case "analytics":
      return (
        <>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">See how your business is growing</p>
          <AnalyticsScreen
            data={previewAnalytics}
            range="30d"
            group="day"
            metrics={["sales", "expenses", "profit"]}
            months={12}
            cmp="item"
            basePath="/preview/analytics"
          />
        </>
      );
    case "accounts":
      return (
        <>
          <h1 className="page-title">Business accounts</h1>
          <p className="page-subtitle">Manage where your business money is held</p>
          <AccountsScreen data={previewAccounts} />
        </>
      );
    case "settlements":
      return (
        <>
          <h1 className="page-title">Settlements</h1>
          <p className="page-subtitle">Collect customer balances and pay suppliers</p>
          <SettlementsScreen data={previewSettlements} />
        </>
      );
    case "stall":
      return (
        <>
          <h1 className="page-title">Online stall</h1>
          <p className="page-subtitle">Live on Quonnect Online Market</p>
          <StallScreen
            data={previewStallData}
            initialCustomise={one(query.customise) === "1"}
          />
        </>
      );
    case "profile":
      return (
        <>
          <h1 className="page-title">My profile</h1>
          <p className="page-subtitle">Your business details</p>
          <ProfileScreen data={{ vendor: previewVendor, stall: previewStall }} />
        </>
      );
    default:
      notFound();
  }
}
