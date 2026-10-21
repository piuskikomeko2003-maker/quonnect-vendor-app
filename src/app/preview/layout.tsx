import type { CSSProperties } from "react";
import { Header } from "@/components/app/Header";
import { TabBar } from "@/components/app/TabBar";
import { previewStall, previewVendor } from "@/lib/fixtures";

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app" style={{ "--accent": previewStall.accent_color } as CSSProperties}>
      <Header
        ownerName={previewVendor.owner_name}
        businessName={previewVendor.business_name}
        logoUrl={previewVendor.logo_url}
      />
      <main className="app-main">{children}</main>
      <TabBar />
    </div>
  );
}
