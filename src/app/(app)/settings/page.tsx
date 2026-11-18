"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { MonthRangeSettings } from "@/components/screens/MonthRangeSettings";
import { Icon } from "@/components/ui/Icon";
import { useVendor } from "@/components/app/VendorProvider";
import { usePageTitle } from "@/lib/query";

const LINKS = [
  {
    href: "/profile",
    icon: "user" as const,
    title: "Account & profile",
    body: "Your name, phone, logo and socials",
  },
  {
    href: "/stall",
    icon: "store" as const,
    title: "Online stall",
    body: "Stall name, tagline and accent colour",
  },
  {
    href: "/notifications",
    icon: "bell" as const,
    title: "Notifications",
    body: "Updates and helpful tips",
  },
];

export default function SettingsPage() {
  usePageTitle("Settings · Quonnect Vendor");
  const { vendor } = useVendor();

  return (
    <>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Account, stall and app settings</p>

      <MonthRangeSettings monthStartDay={vendor.month_start_day ?? 1} />

      <div className="subpage-card">
        {LINKS.map((item) => (
          <Link className="subpage-row" href={item.href} key={item.href}>
            <span className="ci">
              <Icon name={item.icon} size={19} />
            </span>
            <span className="grow">
              <b>{item.title}</b>
              <small>{item.body}</small>
            </span>
            <Icon name="chevr" size={16} />
          </Link>
        ))}
      </div>

      <div className="subpage-card">
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
    </>
  );
}
