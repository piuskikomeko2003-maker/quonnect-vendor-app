"use client";

import { useEffect, useRef } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  labelledBy?: string;
}

export function BottomSheet({ open, onClose, title, subtitle, children, labelledBy }: BottomSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={labelledBy ?? (title ? "sheet-title" : undefined)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="sheet-inner">
        <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {title ? (
          <h2 id={labelledBy ?? "sheet-title"} style={{ paddingRight: 34 }}>
            {title}
          </h2>
        ) : null}
        {subtitle ? <p className="sheet-sub">{subtitle}</p> : null}
        {children}
      </div>
    </dialog>
  );
}
