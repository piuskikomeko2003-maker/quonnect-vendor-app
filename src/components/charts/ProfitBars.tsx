"use client";

import { useState } from "react";
import { profitBarLabelLayout, profitBarScale } from "@/lib/chart";
import { formatMoney, formatNumber, monthDayLabel, shortMoney, weekdayLabel } from "@/lib/format";

export function ProfitBars({ days, vals }: { days: string[]; vals: number[] }) {
  const [active, setActive] = useState(Math.max(0, days.length - 1));
  const width = 340;
  const height = 236;
  const L = 66;
  const R = 8;
  const T = 26;
  const B = 68;
  const innerWidth = width - L - R;
  const innerHeight = height - T - B;
  const count = days.length;

  const rawMax = Math.max(...vals, 0);
  const rawMin = Math.min(...vals, 0);
  if (rawMax === 0 && rawMin === 0) {
    return <div className="empty">No profit recorded for this period yet</div>;
  }
  const { max, min, step } = profitBarScale(vals);
  const range = max - min || 1;
  const y = (value: number) => T + innerHeight - ((value - min) / range) * innerHeight;
  const groupWidth = innerWidth / count;
  const barWidth = Math.max(2, Math.min(30, groupWidth * 0.7));
  const few = count <= 8;
  const labelStep = Math.ceil(count / 6);

  const grid: { value: number; y: number }[] = [];
  for (let value = min; value <= max + step / 2; value += step) {
    grid.push({ value, y: y(value) });
  }

  const current = Math.min(active, count - 1);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Daily profit bar chart">
        <defs>
          <linearGradient id="profit-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        {grid.map((line) => (
          <g key={line.value}>
            <line x1={L} x2={width - R} y1={line.y} y2={line.y} stroke="#E2ECE7" strokeWidth="1" />
            <text x={L - 6} y={line.y + 3} textAnchor="end" fontSize="7.5" fill="#546A63" fontWeight="500">
              UGX {formatNumber(line.value)}
            </text>
          </g>
        ))}
        {vals.map((value, index) => {
          const centerX = L + groupWidth * index + groupWidth / 2;
          const zeroY = y(0);
          const valueY = y(value);
          const top = Math.min(zeroY, valueY);
          const barHeight = Math.max(1, Math.abs(zeroY - valueY));
          const label = profitBarLabelLayout(value, valueY);
          return (
            <g key={days[index] ?? index}>
              <rect
                x={centerX - barWidth / 2}
                y={top}
                width={barWidth}
                height={barHeight}
                rx={Math.min(5, barWidth / 2)}
                fill={value < 0 ? "#DC2626" : "url(#profit-grad)"}
              />
              {few ? (
                <text
                  x={centerX}
                  y={label.y}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="700"
                  fill="#0D1A16"
                >
                  UGX {shortMoney(value)}
                </text>
              ) : null}
              {few ? (
                <>
                  <text x={centerX} y={height - B + 16} textAnchor="middle" fontSize="9" fill="#546A63" fontWeight="500">
                    {monthDayLabel(days[index])}
                  </text>
                  <text x={centerX} y={height - B + 28} textAnchor="middle" fontSize="9" fill="#546A63" fontWeight="500">
                    {weekdayLabel(days[index])}
                  </text>
                </>
              ) : (count - 1 - index) % labelStep === 0 ? (
                <text
                  x={index === count - 1 ? centerX + barWidth / 2 : centerX}
                  y={height - B + 16}
                  textAnchor={index === count - 1 ? "end" : "middle"}
                  fontSize="9"
                  fill="#546A63"
                  fontWeight="500"
                >
                  {monthDayLabel(days[index])}
                </text>
              ) : null}
              <rect
                x={L + groupWidth * index}
                y={T}
                width={groupWidth}
                height={innerHeight}
                fill="transparent"
                style={{ cursor: "pointer" }}
                tabIndex={0}
                role="button"
                aria-label={`Show ${monthDayLabel(days[index])}`}
                onClick={() => setActive(index)}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
              />
            </g>
          );
        })}
      </svg>
      {!few ? (
        <div className="chart-ro" id="ro_hb">
          <b>
            {monthDayLabel(days[current])} ({weekdayLabel(days[current])})
          </b>
          <span>
            <i className="dotc" style={{ background: "#1D4ED8" }} />
            Net profit <b>{formatMoney(vals[current] ?? 0)}</b>
          </span>
        </div>
      ) : null}
    </div>
  );
}
