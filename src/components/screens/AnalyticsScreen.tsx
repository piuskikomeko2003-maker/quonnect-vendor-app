"use client";

import { useRouter } from "next/navigation";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Icon } from "@/components/ui/Icon";
import {
  ANALYTICS_RANGES,
  GROUP_NAMES,
  GROUPS,
  METRIC_COLORS,
  type AnalyticsRange,
  type GroupBy,
  type Metric,
} from "@/lib/constants";
import { MoneyText } from "@/components/ui/MoneyText";
import { formatMoney, monthShort } from "@/lib/format";
import type { AnalyticsData } from "@/lib/types";

const COLORS = {
  sales: "#1D4ED8",
  expenses: "#6B7F7A",
  profit: "#60A5FA",
  cost: "#9AA59F",
  expected: "#60A5FA",
  actual: "#1D4ED8",
};

const METRIC_NAMES: Record<Metric, string> = {
  sales: "Sales",
  expenses: "Expenses",
  profit: "Profit",
};

interface AnalyticsScreenProps {
  data: AnalyticsData;
  range: AnalyticsRange;
  group: GroupBy;
  metrics: Metric[];
  months: number;
  cmp: "item" | "time";
  basePath?: string;
  /** Extra query values to keep when a control changes, e.g. the Business tab. */
  preserveParams?: Record<string, string>;
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="legend">
      {items.map(([label, color]) => (
        <span key={label}>
          <i className="dotc" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}

function changePill(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return (
    <small className={value >= 0 ? "pos" : "neg"} style={{ display: "block", marginTop: 2 }}>
      {value >= 0 ? "▲ " : "▼ "}
      {Math.abs(value) > 999 ? "999%+" : `${Math.abs(Math.round(value))}%`} vs before
    </small>
  );
}

export function AnalyticsScreen({
  data,
  range,
  group,
  metrics,
  months,
  cmp,
  basePath = "/analytics",
  preserveParams,
}: AnalyticsScreenProps) {
  const router = useRouter();

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams({
      range,
      group,
      metrics: metrics.join(","),
      months: String(months),
      cmp,
      ...preserveParams,
      ...patch,
    });
    router.push(`${basePath}?${params.toString()}`);
  }

  function setRange(next: AnalyticsRange) {
    apply({ range: next, group: GROUPS[next].includes(group) ? group : GROUPS[next][0] });
  }

  function toggleMetric(metric: Metric) {
    if (metrics.includes(metric)) {
      if (metrics.length === 1) return;
      apply({ metrics: metrics.filter((item) => item !== metric).join(",") });
    } else {
      apply({ metrics: [...metrics, metric].join(",") });
    }
  }

  const growth = data.previousSales
    ? ((data.totals.sales - data.previousSales) / data.previousSales) * 100
    : null;

  const monthlyLabels = data.monthly.map((row) => monthShort(row.month));
  const salesValues = data.monthly.map((row) => Number(row.sales));
  const bestIndex = salesValues.reduce(
    (best, value, index) => (value > (salesValues[best] ?? 0) ? index : best),
    0,
  );
  const average = salesValues.length
    ? salesValues.reduce((total, value) => total + value, 0) / salesValues.length
    : 0;
  const lastFull = data.monthly.length > 1 ? Number(data.monthly[data.monthly.length - 2].sales) : 0;
  const beforeLast =
    data.monthly.length > 2 ? Number(data.monthly[data.monthly.length - 3].sales) : 0;
  const lastFullGrowth = beforeLast ? ((lastFull - beforeLast) / beforeLast) * 100 : null;

  const expectedTotal = data.monthly.reduce((total, row) => total + Number(row.expected_revenue), 0);
  const actualTotal = data.monthly.reduce((total, row) => total + Number(row.sales), 0);
  const cuts = Math.max(0, expectedTotal - actualTotal);

  const categoryTotal = data.categories.reduce((total, row) => total + Number(row.total), 0);
  const categoryMax = data.categories.length ? Number(data.categories[0].total) : 0;

  return (
    <>
      <div className="card">
        <h3>
          Business growth{" "}
          <span style={{ fontWeight: 500 }}>
            {ANALYTICS_RANGES.find(([key]) => key === range)?.[1]}
          </span>
        </h3>
        <div className="lbl" style={{ marginTop: 0 }}>
          Time range
        </div>
        <div className="opts">
          {ANALYTICS_RANGES.map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={`opt ${range === key ? "on" : ""}`}
              aria-pressed={range === key}
              onClick={() => setRange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="lbl">Group by</div>
        <div className="opts">
          {GROUPS[range].map((key) => (
            <button
              type="button"
              key={key}
              className={`opt ${group === key ? "on" : ""}`}
              aria-pressed={group === key}
              onClick={() => apply({ group: key })}
            >
              {GROUP_NAMES[key]}
            </button>
          ))}
        </div>
        <div className="lbl">Show on graph</div>
        <div className="opts">
          {(Object.keys(METRIC_NAMES) as Metric[]).map((metric) => {
            const on = metrics.includes(metric);
            const locked = on && metrics.length === 1;
            return (
              <button
                type="button"
                key={metric}
                className={`opt${locked ? " is-locked" : ""}`}
                style={
                  on
                    ? { background: METRIC_COLORS[metric], borderColor: METRIC_COLORS[metric], color: "#fff" }
                    : undefined
                }
                aria-pressed={on}
                aria-disabled={locked}
                title={locked ? "Keep at least one metric on the graph" : undefined}
                onClick={() => toggleMetric(metric)}
              >
                {on ? null : (
                  <i className="dotc" style={{ background: METRIC_COLORS[metric] }} />
                )}
                {METRIC_NAMES[metric]}
              </button>
            );
          })}
        </div>

        <div className="grid3" style={{ margin: "14px 0 8px" }}>
          <div className="stat">
            <small>Sales</small>
            <b><MoneyText amount={data.totals.sales} className="inline-money" /></b>
            {changePill(growth)}
          </div>
          <div className="stat">
            <small>Expenses</small>
            <b><MoneyText amount={data.totals.expenses} className="inline-money" /></b>
          </div>
          <div className="stat">
            <small>Profit</small>
            <b className={data.totals.profit >= 0 ? "pos" : "neg"}>
              <MoneyText amount={data.totals.profit} className="inline-money" />
            </b>
          </div>
        </div>

        <LineChart
          id="cg"
          labels={data.grouped.labels}
          ariaLabel="Business growth line chart"
          series={metrics.map((metric) => ({
            name: METRIC_NAMES[metric],
            color: METRIC_COLORS[metric],
            vals:
              metric === "sales"
                ? data.grouped.sales
                : metric === "expenses"
                  ? data.grouped.expenses
                  : data.grouped.profit,
          }))}
        />
      </div>

      <div className="card">
        <h3>Monthly charts</h3>
        <div className="opts">
          <button
            type="button"
            className={`opt ${months === 6 ? "on" : ""}`}
            onClick={() => apply({ months: "6" })}
          >
            Last 6 months
          </button>
          <button
            type="button"
            className={`opt ${months === 12 ? "on" : ""}`}
            onClick={() => apply({ months: "12" })}
          >
            Last 12 months
          </button>
        </div>
        <small style={{ display: "block", color: "var(--mut)", fontSize: 11.5, marginTop: 8 }}>
          Applies to the three charts below. The current month is still in progress.
        </small>
      </div>

      <div className="card">
        <h3>Sales per month</h3>
        <LineChart
          id="cm"
          labels={monthlyLabels}
          ariaLabel="Sales per month line chart"
          series={[{ name: "Sales", color: COLORS.sales, vals: salesValues }]}
        />
        <div className="grid3" style={{ marginTop: 12 }}>
          <div className="stat">
            <small>Best month</small>
            <b>{monthlyLabels[bestIndex] ?? "—"}</b>
            <small><MoneyText amount={salesValues[bestIndex] ?? 0} className="inline-money" /></small>
          </div>
          <div className="stat">
            <small>Monthly average</small>
            <b><MoneyText amount={average} className="inline-money" /></b>
          </div>
          <div className="stat">
            <small>Last full month</small>
            <b><MoneyText amount={lastFull} className="inline-money" /></b>
            {changePill(lastFullGrowth)}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Expense trend</h3>
        <Legend
          items={[
            ["Total spent", COLORS.expenses],
            ["Running costs (no stock purchases)", COLORS.cost],
          ]}
        />
        <LineChart
          id="ce"
          labels={monthlyLabels}
          ariaLabel="Expense trend line chart"
          series={[
            {
              name: "Total spent",
              color: COLORS.expenses,
              vals: data.monthly.map((row) => Number(row.expenses)),
            },
            {
              name: "Running costs",
              color: COLORS.cost,
              vals: data.monthly.map((row) => Number(row.operating_expenses)),
            },
          ]}
        />
        <div className="lbl">Where the money went</div>
        {data.categories.length ? (
          data.categories.map((row) => (
            <div style={{ marginBottom: 10 }} key={row.category}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 8 }}>
                <b>{row.category}</b>
                <span>
                  {formatMoney(row.total)} · {Math.round((Number(row.total) / categoryTotal) * 100)}%
                </span>
              </div>
              <div className="bar">
                <i
                  style={{
                    width: `${(Number(row.total) / categoryMax) * 100}%`,
                    background: COLORS.expenses,
                  }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="empty">No expenses recorded</div>
        )}
      </div>

      <div className="card">
        <h3>Cost vs expected vs actual price</h3>
        <div className="opts" style={{ marginBottom: 10 }}>
          <button
            type="button"
            className={`opt ${cmp === "item" ? "on" : ""}`}
            onClick={() => apply({ cmp: "item" })}
          >
            By item
          </button>
          <button
            type="button"
            className={`opt ${cmp === "time" ? "on" : ""}`}
            onClick={() => apply({ cmp: "time" })}
          >
            Over time
          </button>
        </div>
        <div className="grid3" style={{ marginBottom: 6 }}>
          <div className="stat">
            <small>Expected revenue</small>
            <b><MoneyText amount={expectedTotal} className="inline-money" /></b>
          </div>
          <div className="stat">
            <small>Actual revenue</small>
            <b><MoneyText amount={actualTotal} className="inline-money" /></b>
          </div>
          <div className="stat">
            <small>Price cuts given</small>
            <b className={cuts > 0 ? "neg" : ""}>
              <MoneyText amount={cuts} className="inline-money" />
            </b>
          </div>
        </div>
        <small style={{ display: "block", color: "var(--mut)", fontSize: 11.5, marginBottom: 8 }}>
          {cmp === "time"
            ? `Last ${months} months. Expected = what sales would bring at listed prices.`
            : "Average price per item across sales recorded item by item."}
        </small>

        {cmp === "time" ? (
          <>
            <Legend
              items={[
                ["Cost of goods", COLORS.cost],
                ["Expected (listed) revenue", COLORS.expected],
                ["Actual revenue", COLORS.actual],
              ]}
            />
            <LineChart
              id="cc"
              labels={monthlyLabels}
              ariaLabel="Cost versus expected and actual revenue"
              series={[
                {
                  name: "Cost of goods",
                  color: COLORS.cost,
                  vals: data.monthly.map((row) => Number(row.cogs)),
                },
                {
                  name: "Expected",
                  color: COLORS.expected,
                  vals: data.monthly.map((row) => Number(row.expected_revenue)),
                },
                {
                  name: "Actual",
                  color: COLORS.actual,
                  vals: data.monthly.map((row) => Number(row.sales)),
                },
              ]}
            />
          </>
        ) : (
          <>
            <Legend
              items={[
                ["Cost price", COLORS.cost],
                ["Expected price (listed)", COLORS.expected],
                ["Actual price (avg sold)", COLORS.actual],
              ]}
            />
            <BarChart
              id="cb"
              labels={data.items.map((item) => item.name)}
              ariaLabel="Cost, expected and actual price by item"
              series={[
                {
                  name: "Cost",
                  color: COLORS.cost,
                  vals: data.items.map((item) => Number(item.cost)),
                },
                {
                  name: "Expected",
                  color: COLORS.expected,
                  vals: data.items.map((item) => Number(item.expected)),
                },
                {
                  name: "Actual",
                  color: COLORS.actual,
                  vals: data.items.map((item) => Number(item.actual)),
                },
              ]}
            />
            <div style={{ marginTop: 10 }}>
              {data.items.map((item) => {
                const reference = item.sold ? Number(item.actual) : Number(item.expected);
                const margin = reference ? ((reference - Number(item.cost)) / reference) * 100 : 0;
                return (
                  <div className="row" key={item.name}>
                    <div className="grow">
                      <b>{item.name}</b>
                      <small>
                        Cost {formatMoney(item.cost)} · Expected {formatMoney(item.expected)} ·{" "}
                        {item.sold ? `Actual ${formatMoney(item.actual)}` : "Not sold yet"}
                      </small>
                    </div>
                    <span className={`tag ${margin < 0 ? "red" : ""}`}>
                      {Math.round(margin)}% margin
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <small
        style={{
          display: "block",
          color: "var(--mut)",
          fontSize: 11.5,
          lineHeight: 1.5,
          padding: "0 4px",
        }}
      >
        <Icon name="chart" size={12} /> Profit = sales minus cost of goods, minus running costs, plus
        other income. Stock purchases are not subtracted again because the cost of each item is
        already counted when it sells.
      </small>
    </>
  );
}
