"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const noopSubscribe = () => () => {};
const onClient = () => true;
const onServer = () => false;

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  labelledBy?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bottom sheet rendered through a portal on `document.body`.
 *
 * It deliberately does not use `<dialog>.showModal()`: several Android
 * browsers/WebViews either lack it or fail to place the dialog in the top
 * layer, which made every sheet-opening control (Edit, Deal, Add product,
 * Restock, ...) look dead. A portal + fixed overlay works everywhere and is
 * not clipped by the scrolling `.app-main` container.
 */
export function BottomSheet({ open, onClose, title, subtitle, children, labelledBy }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Server snapshot is `false` and client snapshot is `true`, so the portal is
  // only rendered after hydration without causing a mismatch.
  const mounted = useSyncExternalStore(noopSubscribe, onClient, onServer);
  const generatedId = useId();
  const titleId = labelledBy ?? `sheet-title-${generatedId}`;

  // Lock page scroll while the sheet is open and restore focus afterwards.
  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      restoreRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  // Move focus into the sheet, close on Escape and keep Tab inside it.
  // `mounted` is part of the deps because the portal (and therefore
  // panelRef.current) only exists after the first client render.
  useEffect(() => {
    if (!open || !mounted) return;
    const panel = panelRef.current;
    if (!panel) return;

    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel).focus({ preventScroll: true });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const nodes = Array.from(panel!.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!nodes.length) {
        event.preventDefault();
        panel!.focus();
        return;
      }
      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, mounted, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="sheet-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : labelledBy}
        tabIndex={-1}
      >
        <div className="sheet-inner">
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {title ? (
            <h2 id={titleId} style={{ paddingRight: 34 }}>
              {title}
            </h2>
          ) : null}
          {subtitle ? <p className="sheet-sub">{subtitle}</p> : null}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
