"use client";

import Link from "next/link";
import { useVendor } from "@/components/app/VendorProvider";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/lib/constants";
import { hasFeature, type FeatureKey } from "@/lib/features";
import { usePageTitle } from "@/lib/query";

interface MenuLink {
  href: string;
  icon: IconKey;
  title: string;
  body: string;
  feature?: FeatureKey;
  badge?: string;
}

const GROUPS: { title: string; links: MenuLink[] }[] = [
  {
    title: "Account",
    links: [
      { href: "/profile", icon: "user", title: "My profile", body: "Your business details and logo" },
      { href: "/settings", icon: "gear", title: "Settings", body: "Account, stall and app settings" },
      { href: "/notifications", icon: "bell", title: "Notifications", body: "Updates and helpful tips" },
    ],
  },
  {
    title: "Business",
    links: [
      {
        href: "/business",
        icon: "wallet",
        title: "Business hub",
        body: "Money, analytics and customers together",
        badge: "New",
      },
      { href: "/stall", icon: "store", title: "Online stall", body: "Products, deals and stall customisation" },
      { href: "/sell", icon: "cart", title: "Record a sale", body: "Add items, set prices and make receipts" },
      { href: "/stock", icon: "box", title: "My stock", body: "Register items and restock" },
      {
        href: "/business?tab=money",
        icon: "wallet",
        title: "Income & expenses",
        body: "Expenses, income and budgets",
      },
      {
        href: "/accounts",
        icon: "coins",
        title: "Business accounts",
        body: "Cash, bank, mobile money and transfers",
        badge: "New",
      },
      {
        href: "/settlements",
        icon: "swap",
        title: "Settlements",
        body: "Customer collections and supplier payments",
        badge: "New",
      },
      {
        href: "/business?tab=analytics",
        icon: "chart",
        title: "Analytics & reports",
        body: "Trends, growth and item performance",
        feature: "analytics",
      },
      { href: "/orders", icon: "orders", title: "Orders", body: "Sales, bookings and customer messages" },
      {
        href: "/business?tab=customers",
        icon: "user",
        title: "Customers",
        body: "Your customer list and contact details",
        feature: "customers",
        badge: "New",
      },
    ],
  },
];

export default function MenuPage() {
  usePageTitle("Menu · Quonnect Vendor");
  const { vendor } = useVendor();

  function visible(item: MenuLink) {
    return !item.feature || hasFeature(vendor, item.feature);
  }

  return (
    <>
      <h1 className="page-title">Menu</h1>
      <p className="page-subtitle">Everything else, in one place</p>

      {GROUPS.map((group) => (
        <section className="menu-group" key={group.title}>
          <h2>{group.title}</h2>
          <div className="subpage-card">
            {group.links.filter(visible).map((item) => (
              <Link className="subpage-row" href={item.href} key={`${item.href}-${item.title}`}>
                <span className="ci">
                  <Icon name={item.icon} size={19} />
                </span>
                <span className="grow">
                  <b>
                    {item.title}
                    {item.badge ? <span className="tag" style={{ marginLeft: 7 }}>{item.badge}</span> : null}
                  </b>
                  <small>{item.body}</small>
                </span>
                <Icon name="chevr" size={16} />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <section className="menu-group">
        <h2>Support</h2>
        <div className="subpage-card">
          <Link className="subpage-row" href="/help">
            <span className="ci">
              <Icon name="quote" size={19} />
            </span>
            <span className="grow">
              <b>Help &amp; support</b>
              <small>How Quonnect works and how to reach us</small>
            </span>
            <Icon name="chevr" size={16} />
          </Link>
          <div className="subpage-row">
            <span className="ci">
              <Icon name="logout" size={19} />
            </span>
            <span className="grow">
              <b>Log out</b>
              <small>Sign out of this device</small>
            </span>
            <SignOutButton className="link" />
          </div>
        </div>
      </section>
    </>
  );
}
