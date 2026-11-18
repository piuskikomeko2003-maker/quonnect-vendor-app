"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/lib/constants";

/**
 * Consistent empty state for pages and lists. Every empty state should tell
 * the vendor what happened and what they can do next.
 */
export function EmptyState({
  icon = "box",
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: {
  icon?: IconKey;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}) {
  return (
    <div className="empty-state">
      <span className="icon-circle solid">
        <Icon name={icon} size={22} />
      </span>
      <b>{title}</b>
      {description ? <small>{description}</small> : null}
      {actionLabel && actionHref ? (
        <Link className="btn sm" href={actionHref}>
          {actionLabel}
        </Link>
      ) : actionLabel && onAction ? (
        <button type="button" className="btn sm" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
