import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { OfflineSyncIndicator } from "@/components/layout/OfflineSyncIndicator";

export const metadata: Metadata = {
  title: "Quonnect Vendor App — Modular Market Stall Business Manager",
  description: "Mobile-first POS, product catalog, customer debts, and financial reports for African market vendors.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Quonnect Vendor",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased light">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-teal-500 selection:text-white">
        <AuthProvider>
          <OfflineSyncIndicator />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
