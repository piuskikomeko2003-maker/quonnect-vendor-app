"use client";

import { useState } from "react";
import { formatUGX, shortMoney } from "@/lib/format";
import { niceMax } from "@/lib/chart";
import type { ChartSeries } from "@/components/charts/LineChart";

export function BarChart({
  id,
  labels,
  series,
  ariaLabel = "Bar chart",
}: {
  id: string;
  labels: string[];
  series: ChartSeries[];
  ariaLabel?: string;
}) {
  const [active, setActive] = useState(0);
  const width = 340;
  const height = 210;
  const L = 40;
  const R = 8;
  const T = 12;
  const B = 40;
  const innerWidth = width - L - R;
  const innerHeight = height - T - B;
  const count = labels.length;
  let max = 0;
  series.forEach((entry) => entry.vals.forEach((value) => (max = Math.max(max, value))));

  if (!max || !count) return <div className="empty">No items yet</div>;
  max = niceMax(max);

  const groupWidth = innerWidth / count;
  const barWidth = Math.min(20, (groupWidth - 10) / series.length);
  const y = (value: number) => T + innerHeight - (value / max) * innerHeight;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = (max * index) / 4;
    return { value, y: y(value) };
  });
  const current = Math.min(active, count - 1);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={ariaLabel}>
        {grid.map((line) => (
          <g key={line.value}>
            <line x1={L} x2={width - R} y1={line.y} y2={line.y} stroke="#E2ECE7" strokeWidth="1" />
            <text x={L - 6} y={line.y + 3.5} textAnchor="end" fontSize="9.5" fill="#546A63" fontWeight="500">
              {shortMoney(line.value)}
            </text>
          </g>
        ))}
        {labels.map((label, index) => {
          const startX = L + groupWidth * index + (groupWidth - barWidth * series.length) / 2;
          return (
            <g key={`${label}-${index}`}>
              {series.map((entry, seriesIndex) => {
                const value = entry.vals[index] || 0;
                if (value <= 0) return null;
                return (
                  <rect
                    key={entry.name}
                    x={startX + barWidth * seriesIndex}
                    y={y(value)}
                    width={barWidth - 2}
                    height={T + innerHeight - y(value)}
                    rx="3"
                    fill={entry.color}
                  />
                );
              })}
              <text
                x={L + groupWidth * index + groupWidth / 2}
                y={height - B + 15}
                textAnchor="middle"
                fontSize="9.5"
                fill="#546A63"
                fontWeight="500"
              >
                {label.length > 9 ? `${label.slice(0, 8)}…` : label}
              </text>
              <rect
                x={L + groupWidth * index}
                y={T}
                width={groupWidth}
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
            </g>
          );
        })}
      </svg>
      <div className="chart-ro" id={`ro_${id}`}>
        <b>{labels[current]}</b>
        {series.map((entry) => (
          <span key={entry.name}>
            <i className="dotc" style={{ background: entry.color }} />
            {entry.name} <b>{formatUGX(entry.vals[current] ?? 0)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
