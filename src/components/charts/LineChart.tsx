"use client";

import { useMemo, useState } from "react";
import { shortMoney, formatUGX } from "@/lib/format";
import { niceMax } from "@/lib/chart";

export interface ChartSeries {
  name: string;
  color: string;
  vals: number[];
}

export function LineChart({
  id,
  labels,
  series,
  height = 190,
  ariaLabel = "Line chart",
}: {
  id: string;
  labels: string[];
  series: ChartSeries[];
  height?: number;
  ariaLabel?: string;
}) {
  const [active, setActive] = useState(Math.max(0, labels.length - 1));
  const geometry = useMemo(() => {
    const width = 340;
    const H = height;
    const L = 40;
    const R = 12;
    const T = 12;
    const B = 26;
    const innerWidth = width - L - R;
    const innerHeight = H - T - B;
    const count = labels.length;
    let max = 0;
    let min = 0;
    series.forEach((lineEntry) =>
      lineEntry.vals.forEach((value) => {
        if (value > max) max = value;
        if (value < min) min = value;
      }),
    );
    max = niceMax(max);
    if (min < 0) min = -niceMax(-min);
    const range = max - min || 1;
    const x = (index: number) =>
      L + (count < 2 ? innerWidth / 2 : (index * innerWidth) / (count - 1));
    const y = (value: number) => T + innerHeight - ((value - min) / range) * innerHeight;
    return { width, H, L, R, T, B, innerWidth, innerHeight, count, min, range, x, y };
  }, [height, labels.length, series]);

  if (!labels.length) return <div className="empty">No data for this period yet</div>;
  const hasData = series.some((lineEntry) => lineEntry.vals.some((value) => value !== 0));
  if (!hasData) return <div className="empty">No data for this period yet</div>;

  const { width, H, L, R, T, innerWidth, innerHeight, count, min, range, x, y } = geometry;
  const clampedActive = Math.min(active, count - 1);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = min + (range * index) / 4;
    return { value, y: y(value) };
  });
  const step = Math.ceil(count / 6);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${H}`} width="100%" role="img" aria-label={ariaLabel}>
        {grid.map((line) => (
          <g key={line.value}>
            <line x1={L} x2={width - R} y1={line.y} y2={line.y} stroke="#E3ECEA" />
            <text x={L - 6} y={line.y + 3.5} textAnchor="end" fontSize="9.5" fill="#6B7F7A">
              {shortMoney(line.value)}
            </text>
          </g>
        ))}
        {min < 0 ? (
          <line
            x1={L}
            x2={width - R}
            y1={y(0)}
            y2={y(0)}
            stroke="#9FB3AE"
          />
        ) : null}
        {labels.map((label, index) =>
          (count - 1 - index) % step === 0 ? (
            <text
              key={`${label}-${index}`}
              x={x(index)}
              y={H - 8}
              textAnchor="middle"
              fontSize="9.5"
              fill="#6B7F7A"
            >
              {label}
            </text>
          ) : null,
        )}
        {series.map((lineEntry) => {
          const path = lineEntry.vals
            .map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`)
            .join(" ");
          return (
            <g key={lineEntry.name}>
              <path
                d={path}
                fill="none"
                stroke={lineEntry.color}
                strokeWidth="2.4"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {count <= 16
                ? lineEntry.vals.map((value, index) => (
                    <circle
                      key={index}
                      cx={x(index)}
                      cy={y(value)}
                      r="3"
                      fill="#fff"
                      stroke={lineEntry.color}
                      strokeWidth="2"
                    />
                  ))
                : null}
            </g>
          );
        })}
        <line
          x1={x(clampedActive)}
          x2={x(clampedActive)}
          y1={T}
          y2={T + innerHeight}
          stroke="#10241F"
          strokeOpacity=".28"
          strokeDasharray="3 3"
        />
        {labels.map((label, index) => {
          const barWidth = count < 2 ? innerWidth : innerWidth / (count - 1);
          return (
            <rect
              key={`hit-${id}-${index}`}
              x={x(index) - barWidth / 2}
              y={T}
              width={barWidth}
              height={innerHeight}
              fill="transparent"
              style={{ cursor: "pointer" }}
              tabIndex={0}
              role="button"
              aria-label={`Show ${label}`}
              onClick={() => setActive(index)}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
            />
          );
        })}
      </svg>
      <div className="chart-ro" id={`ro_${id}`}>
        <b>{labels[clampedActive]}</b>
        {series.map((lineEntry) => (
          <span key={lineEntry.name}>
            <i className="dotc" style={{ background: lineEntry.color }} />
            {lineEntry.name} <b>{formatUGX(lineEntry.vals[clampedActive] ?? 0)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
