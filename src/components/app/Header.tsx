"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { firstName } from "@/lib/format";

interface HeaderProps {
  ownerName: string | null;
  businessName: string;
  logoUrl: string | null;
}

const TITLES: Record<string, [string, string]> = {
  "/home": ["", "Here is how your business is doing"],
  "/sell": ["Record a sale", "Tap products to add to the cart"],
  "/stock": ["My stock", "Register and monitor your items"],
  "/money": ["Money", "Expenses, income and budgets"],
  "/analytics": ["Analytics", "See how your business is growing"],
  "/stall": ["Online stall", "Live on Quonnect Online Market"],
  "/profile": ["My profile", "Your business details"],
};

export function Header({ ownerName, businessName, logoUrl }: HeaderProps) {
  const pathname = usePathname();
  const entry = TITLES[pathname] ?? TITLES["/home"];
  const title = pathname === "/home" ? `Hello, ${firstName(ownerName)}` : entry[0];

  return (
    <header className="app-header">
      <div className="top">
        <div>
          <h1>{title}</h1>
          <p>{entry[1]}</p>
        </div>
        <div className="header-actions">
          <div className="badge" title="Your data is up to date">
            <span className="dot" />
            <span>Synced</span>
          </div>
          <Link href="/profile" aria-label="Open profile" style={{ display: "flex" }}>
            <Avatar logoUrl={logoUrl} name={businessName} size="header" />
          </Link>
        </div>
      </div>
    </header>
  );
}
