import { notFound } from "next/navigation";
import { AnalyticsScreen } from "@/components/screens/AnalyticsScreen";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { MoneyScreen } from "@/components/screens/MoneyScreen";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { SellScreen } from "@/components/screens/SellScreen";
import { StallScreen } from "@/components/screens/StallScreen";
import { StockScreen } from "@/components/screens/StockScreen";
import { receiptBusiness } from "@/lib/business";
import {
  previewAnalytics,
  previewHome,
  previewMoney,
  previewProducts,
  previewSell,
  previewStall,
  previewStallData,
  previewVendor,
} from "@/lib/fixtures";
import { addDays, todayKey } from "@/lib/format";

/**
 * Dev-only visual QA harness. In production it 404s unless ALLOW_PREVIEW=1.
 * It uses the same client screens and fixtures, so it can be screenshotted
 * without a Supabase connection.
 */
export default async function PreviewPage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PREVIEW !== "1") {
    notFound();
  }

  const { screen } = await params;
  const business = receiptBusiness(previewVendor, previewStall);

  switch (screen) {
    case "home":
      return (
        <HomeScreen
          data={previewHome}
          month={todayKey().slice(0, 7)}
          range="7d"
          from={addDays(todayKey(), -6)}
          to={todayKey()}
          basePath="/preview/home"
        />
      );
    case "sell":
      return (
        <SellScreen
          products={previewSell.products}
          recentSales={previewSell.recentSales}
          business={business}
        />
      );
    case "stock":
      return <StockScreen vendorId={previewVendor.id} products={previewProducts} />;
    case "money":
      return <MoneyScreen data={previewMoney} />;
    case "analytics":
      return (
        <AnalyticsScreen
          data={previewAnalytics}
          range="30d"
          group="day"
          metrics={["sales", "expenses", "profit"]}
          months={12}
          cmp="item"
          basePath="/preview/analytics"
        />
      );
    case "stall":
      return <StallScreen data={previewStallData} />;
    case "profile":
      return <ProfileScreen data={{ vendor: previewVendor, stall: previewStall }} />;
    default:
      notFound();
  }
}
