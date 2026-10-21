import type { CSSProperties } from "react";
import { Header } from "@/components/app/Header";
import { TabBar } from "@/components/app/TabBar";
import { requireVendor } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { vendor, stall } = await requireVendor();

  return (
    <div className="app" style={{ "--accent": stall.accent_color } as CSSProperties}>
      <Header
        ownerName={vendor.owner_name}
        businessName={vendor.business_name}
        logoUrl={vendor.logo_url}
      />
      <main className="app-main">{children}</main>
      <TabBar />
    </div>
  );
}
