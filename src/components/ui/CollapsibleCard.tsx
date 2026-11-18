"use client";

import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import type { IconKey } from "@/lib/constants";

export function CollapsibleCard({
  icon,
  title,
  sub,
  right,
  children,
  defaultOpen = true,
}: {
  icon: IconKey;
  title: string;
  sub: string;
  right?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className="surface collapsible-card">
      <div className="surface-head">
        <span className="icon-circle">
          <Icon name={icon} size={20} />
        </span>
        <div className="grow">
          <b className="surface-title">{title}</b>
          <small className="surface-sub">{sub}</small>
        </div>
        {right}
        <button
          type="button"
          className={`collapse-toggle${open ? " open" : ""}`}
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name="chevd" size={16} />
        </button>
      </div>
      <div id={bodyId} className="collapsible-body" hidden={!open}>
        {children}
      </div>
    </section>
  );
}
