import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NativeBridge } from "@/components/app/NativeBridge";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Quonnect Vendor",
  description: "Run your market stall: stock, sales, money, analytics and your online stall.",
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
  viewportFit: "cover",
  themeColor: "#1D4ED8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <NativeBridge />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
