"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";

export interface SuccessFact {
  label: string;
  value: ReactNode;
  tone?: "pos" | "neg" | "muted";
}

/**
 * Detailed confirmation shown after an important action. It replaces the old
 * one-line toast for money and stock changes, so the vendor can see exactly
 * what changed and in which account.
 */
export function SuccessSheet({
  open,
  onClose,
  title,
  message,
  facts = [],
  warning,
  children,
  actions,
  closeLabel = "Done",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  facts?: SuccessFact[];
  warning?: string;
  children?: ReactNode;
  actions?: ReactNode;
  closeLabel?: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="success-panel" role="status" aria-live="polite">
        <span className="success-icon" aria-hidden="true">
          <Icon name="check" size={32} />
        </span>
        <h2 className="success-title">{title}</h2>
        {message ? <p className="success-message">{message}</p> : null}

        {facts.length ? (
          <dl className="success-facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd className={fact.tone ?? ""}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {warning ? <p className="success-warning">{warning}</p> : null}
        {children}
      </div>

      {actions ? <div className="success-actions">{actions}</div> : null}
      <button type="button" className="btn ghost" onClick={onClose}>
        {closeLabel}
      </button>
    </BottomSheet>
  );
}
