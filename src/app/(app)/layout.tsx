"use client";

import type { CSSProperties } from "react";
import { Header } from "@/components/app/Header";
import { TabBar } from "@/components/app/TabBar";
import { VendorProvider, useVendor } from "@/components/app/VendorProvider";

function AppShell({ children }: { children: React.ReactNode }) {
  const { vendor, stall } = useVendor();

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <VendorProvider>
      <AppShell>{children}</AppShell>
    </VendorProvider>
  );
}
