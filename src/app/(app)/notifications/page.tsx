"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/lib/constants";
import { usePageTitle } from "@/lib/query";

const NOTIFICATIONS: {
  id: string;
  icon: IconKey;
  title: string;
  body: string;
  time: string;
  href: string;
}[] = [
  {
    id: "welcome",
    icon: "store",
    title: "Welcome to Quonnect",
    body: "Set up your online stall so shoppers can find you.",
    time: "Just now",
    href: "/stall",
  },
  {
    id: "photos",
    icon: "camera",
    title: "Add photos to your products",
    body: "Stalls with clear photos get more views and orders.",
    time: "Today",
    href: "/stock",
  },
  {
    id: "stock",
    icon: "box",
    title: "Keep your stock up to date",
    body: "Restock low items so you never miss a sale.",
    time: "This week",
    href: "/stock",
  },
];

export default function NotificationsPage() {
  usePageTitle("Notifications · Quonnect Vendor");

  return (
    <>
      <h1 className="page-title">Notifications</h1>
      <p className="page-subtitle">Updates and helpful tips from Quonnect</p>
      <div className="subpage-card">
        {NOTIFICATIONS.map((item) => (
          <Link className="subpage-row" href={item.href} key={item.id}>
            <span className="ci">
              <Icon name={item.icon} size={19} />
            </span>
            <span className="grow">
              <b>{item.title}</b>
              <small>{item.body}</small>
            </span>
            <span style={{ textAlign: "right", flexShrink: 0 }}>
              <small style={{ display: "block" }}>{item.time}</small>
              <Icon name="chevr" size={14} />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
