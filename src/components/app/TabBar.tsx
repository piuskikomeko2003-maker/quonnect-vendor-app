"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/lib/constants";

interface Tab {
  href: string;
  label: string;
  icon: IconKey;
  center?: boolean;
}

const TABS: Tab[] = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/business", label: "Business", icon: "wallet" },
  { href: "/stall", label: "My Stall", icon: "store", center: true },
  { href: "/orders", label: "Orders", icon: "orders" },
  { href: "/menu", label: "Menu", icon: "menu" },
];

/** Sub-routes that belong to a tab even though they are not its exact href. */
const TAB_ALIASES: Record<string, string[]> = {
  "/business": ["/money", "/analytics", "/customers", "/accounts", "/settlements"],
  "/menu": ["/settings", "/notifications", "/help", "/profile"],
};

function matchesTab(href: string, pathname: string) {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  return (TAB_ALIASES[href] ?? []).some(
    (alias) => pathname === alias || pathname.startsWith(`${alias}/`),
  );
}

export function TabBar() {
  const pathname = usePathname();
  const isPreview = pathname.startsWith("/preview/");

  return (
    <nav className="tabbar" aria-label="Main navigation">
      {TABS.map((tab) => {
        const targetHref = isPreview ? `/preview${tab.href}` : tab.href;
        const bare = isPreview ? pathname.replace(/^\/preview/, "") : pathname;
        const active = matchesTab(tab.href, bare);

        if (tab.center) {
          return (
            <Link
              key={tab.href}
              href={targetHref}
              className={`tabbar-center${active ? " on" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="tabbar-center-btn">
                <Icon name={tab.icon} size={25} />
              </span>
              <span className="tabbar-center-label">{tab.label}</span>
            </Link>
          );
        }

        return (
          <Link
            key={tab.href}
            href={targetHref}
            className={active ? "on" : ""}
            aria-current={active ? "page" : undefined}
          >
            <span className="tabbar-icon-wrap">
              <Icon name={tab.icon} size={21} />
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
