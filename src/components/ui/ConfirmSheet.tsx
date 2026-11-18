"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Confirmation for destructive or hard-to-undo actions. The confirmation text
 * must explain what is kept, not just ask "are you sure".
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  error,
  onConfirm,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {description ? <p className="account-confirm-text">{description}</p> : null}
      {children}
      <div className="err" role="alert">
        {error ?? ""}
      </div>
      <button
        type="button"
        className="btn danger"
        disabled={busy}
        aria-busy={busy ? "true" : undefined}
        onClick={onConfirm}
      >
        {busy ? (
          <>
            <Spinner /> Working…
          </>
        ) : (
          confirmLabel
        )}
      </button>
      <button type="button" className="btn ghost" disabled={busy} onClick={onClose}>
        {cancelLabel}
      </button>
    </BottomSheet>
  );
}
