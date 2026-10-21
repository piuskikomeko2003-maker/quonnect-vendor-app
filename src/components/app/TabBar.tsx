"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/lib/constants";

const TABS: { href: string; label: string; icon: IconKey }[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/sell", label: "Sell", icon: "receipt" },
  { href: "/stock", label: "Stock", icon: "box" },
  { href: "/money", label: "Money", icon: "wallet" },
  { href: "/analytics", label: "Analytics", icon: "chart" },
  { href: "/stall", label: "Stall", icon: "store" },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Main navigation">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname === `/preview${tab.href}`;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "on" : ""}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={tab.icon} size={22} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
