"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";

// useLayoutEffect warns during SSR; fall back to useEffect on the server.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface MoneyTextProps {
  amount: number | string | null | undefined;
  /** Show the "UGX " prefix in the full value. Defaults to true. */
  currency?: boolean;
  /** Optional muted label rendered on its own line under the value. */
  unit?: string;
  unitClassName?: string;
  className?: string;
  /** Force the compact form regardless of available width. */
  compact?: boolean;
  /**
   * Auto-fit to the available width. Defaults to true. Turn off for inline
   * amounts where the surrounding row should simply grow or wrap.
   */
  fit?: boolean;
}

/**
 * Renders a money value that can never truncate.
 *
 * The value uses a fluid font size from CSS. If the full string still does not
 * fit the available width, it falls back to compact notation ("270K", "1.25M")
 * which can be tapped to reveal the exact amount.
 */
export function MoneyText({
  amount,
  currency = true,
  unit,
  unitClassName,
  className = "",
  compact: forceCompact = false,
  fit = true,
}: MoneyTextProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [compact, setCompact] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const full = formatMoney(amount, { currency });
  const short = formatMoney(amount, { compact: true });

  const measure = useCallback(() => {
    if (forceCompact) {
      setCompact(true);
      return;
    }
    if (!fit) {
      setCompact(false);
      return;
    }
    const wrap = wrapRef.current;
    const probe = measureRef.current;
    if (!wrap || !probe) return;
    const available = wrap.clientWidth;
    if (available <= 0) return;
    setCompact(probe.getBoundingClientRect().width > available + 1);
  }, [fit, forceCompact]);

  useIsomorphicLayoutEffect(() => {
    measure();
    if (!forceCompact) setShowFull(false);
  }, [measure, full, forceCompact]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !fit || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [fit, measure]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onFonts = () => measure();
    document.fonts?.ready.then(onFonts).catch(() => {});
  }, [measure]);

  const value = compact ? short : full;

  function toggleFull() {
    if (!compact) return;
    setShowFull((open) => !open);
  }

  return (
    <span ref={wrapRef} className={`money-text ${className}`.trim()}>
      <span
        className={`money-text-value${compact ? " is-compact" : ""}`}
        role={compact ? "button" : undefined}
        tabIndex={compact ? 0 : undefined}
        title={compact ? full : undefined}
        aria-label={compact ? `Show full amount: ${full}` : undefined}
        onClick={
          compact
            ? (event) => {
                event.preventDefault();
                event.stopPropagation();
                toggleFull();
              }
            : undefined
        }
        onKeyDown={
          compact
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  toggleFull();
                }
              }
            : undefined
        }
      >
        {value}
      </span>
      {unit ? <span className={unitClassName ?? "money-text-unit"}>{unit}</span> : null}
      <span ref={measureRef} className="money-text-measure" aria-hidden="true">
        {full}
      </span>
      {compact && showFull ? (
        <span className="money-text-pop" role="status" aria-live="polite">
          {full}
        </span>
      ) : null}
    </span>
  );
}
