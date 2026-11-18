"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";

interface HeaderProps {
  ownerName: string | null;
  businessName: string;
  logoUrl: string | null;
}

function greetingForNow() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Africa/Kampala",
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Header({ ownerName, businessName, logoUrl }: HeaderProps) {
  const pathname = usePathname();
  const isPreview = pathname.startsWith("/preview/");
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const update = () => setGreeting(greetingForNow());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const profileHref = isPreview ? "/preview/profile" : "/profile";
  const notificationsHref = isPreview ? "/preview/profile" : "/notifications";
  const settingsHref = isPreview ? "/preview/profile" : "/settings";
  const displayName = businessName || ownerName || "Your business";

  return (
    <header className="app-header">
      <div className="top">
        <Link href={profileHref} className="hdr-profile" aria-label="Open profile">
          <Avatar logoUrl={logoUrl} name={displayName} size="header" />
          <span className="hdr-greeting">
            <span className="hdr-hello">{greeting}!</span>
            <strong className="hdr-name">{displayName}</strong>
          </span>
        </Link>

        <div className="hdr-actions">
          <Link
            href={notificationsHref}
            className="hdr-icon-btn"
            aria-label="Open notifications, unread"
          >
            <Icon name="bell" size={21} />
            <span className="hdr-unread" aria-hidden="true" />
          </Link>
          <Link href={settingsHref} className="hdr-icon-btn" aria-label="Open settings">
            <Icon name="gear" size={21} />
          </Link>
        </div>
      </div>
    </header>
  );
}
