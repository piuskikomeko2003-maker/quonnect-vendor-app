"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { restockProductAction } from "@/actions/business";
import { ProfitBars } from "@/components/charts/ProfitBars";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { Thumb } from "@/components/ui/Thumb";
import { useToast } from "@/components/ui/Toast";
import {
  addDays,
  clampDateRange,
  monthDayLabel,
  usDayLabel,
  formatUGX,
  monthList,
  monthLongYear,
  monthShort,
  todayKey,
} from "@/lib/format";
import type { HomeData, LowStockProduct, Transaction } from "@/lib/types";
import type { IconKey } from "@/lib/constants";

type HomeRange = "7d" | "30d" | "custom";

const TX_ICONS: Record<string, IconKey> = {
  "Stock purchase": "box",
  Transport: "car",
  Food: "utensils",
  "Stall fee": "store",
  Packaging: "box",
  "Airtime/Data": "mobile",
};

function pctChange(current: number, previous: number): number | null {
  return previous ? ((current - previous) / Math.abs(previous)) * 100 : null;
}

function TrendPill({
  value,
  suffix,
  inverse = false,
}: {
  value: number | null;
  suffix: string;
  inverse?: boolean;
}) {
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="tr" style={{ color: "var(--mut)" }}>
        &nbsp;
      </span>
    );
  }
  const up = value >= 0;
  const good = inverse ? !up : up;
  return (
    <span className={`tr ${good ? "" : "bad"}`}>
      {up ? "▲ +" : "▼ −"}
      {Math.abs(Math.round(value))}% {suffix}
    </span>
  );
}

function transactionIcon(transaction: Transaction): IconKey {
  if (transaction.kind === "sale") return "cart";
  if (transaction.kind === "income") return "mobile";
  return TX_ICONS[transaction.category] ?? "wallet";
}

function transactionSubtitle(transaction: Transaction): string {
  const date = usDayLabel(transaction.date);
  const time = transaction.ts
    ? new Date(transaction.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";
  const category =
    transaction.kind !== "sale" && transaction.category !== transaction.title
      ? `${transaction.category} · `
      : "";
  return `${category}${date}${time ? ` · ${time}` : ""}`;
}

function TransactionRows({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) return <div className="empty">No transactions yet</div>;
  return (
    <>
      {transactions.map((transaction) => {
        const title =
          transaction.kind === "sale" && transaction.items?.length
            ? `Sales – ${transaction.items.slice(0, 2).join(", ")}`
            : transaction.title;
        return (
        <div className="tx" key={`${transaction.kind}-${transaction.id}`}>
          <div className="ci sm">
            <Icon name={transactionIcon(transaction)} size={18} />
          </div>
          <div className="grow">
            <b className="l">{title}</b>
            <small>{transactionSubtitle(transaction)}</small>
          </div>
          <b className={`a ${transaction.amount >= 0 ? "pos" : "neg"}`}>
            {transaction.amount >= 0 ? "+" : "−"} {formatUGX(Math.abs(transaction.amount))}
          </b>
        </div>
        );
      })}
    </>
  );
}

export function HomeScreen({
  data,
  month,
  range,
  from,
  to,
  basePath = "/home",
}: {
  data: HomeData;
  month: string;
  range: HomeRange;
  from: string;
  to: string;
  basePath?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { overview, daily, transactions } = data;
  const [allOpen, setAllOpen] = useState(false);
  const [restockTarget, setRestockTarget] = useState<LowStockProduct | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockCost, setRestockCost] = useState("");
  const [restockExpense, setRestockExpense] = useState(true);
  const [restockBusy, setRestockBusy] = useState(false);
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  const monthOptions = monthList(12).reverse();
  const budgetPercent = overview.budget.total
    ? (overview.budget.spent / overview.budget.total) * 100
    : 0;
  const days = daily.map((row) => row.day);
  const values = daily.map((row) => row.net_profit);

  function setRange(next: HomeRange) {
    if (next === "custom") {
      const defaults = from && to ? { from, to } : { from: addDays(todayKey(), -13), to: todayKey() };
      const search = new URLSearchParams({ month, range: "custom", ...defaults });
      router.push(`${basePath}?${search.toString()}`);
      return;
    }
    const search = new URLSearchParams({ month, range: next });
    router.push(`${basePath}?${search.toString()}`);
  }

  function applyCustomDates(nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) return;
    const clamped = clampDateRange(nextFrom, nextTo, 60);
    setCustomFrom(clamped.from);
    setCustomTo(clamped.to);
    const search = new URLSearchParams({
      month,
      range: "custom",
      from: clamped.from,
      to: clamped.to,
    });
    router.push(`${basePath}?${search.toString()}`);
  }

  async function doRestock() {
    if (!restockTarget) return;
    setRestockBusy(true);
    const result = await restockProductAction(
      restockTarget.id,
      Number(restockQty),
      restockCost ? Number(restockCost) : null,
      restockExpense,
    );
    setRestockBusy(false);
    if (!result.ok) {
      toast(result.error ?? "Could not restock");
      return;
    }
    setRestockTarget(null);
    setRestockQty("");
    setRestockCost("");
    toast("Stock updated");
    router.refresh();
  }

  const subtitle =
    range === "7d"
      ? "Your daily net profit for the last 7 days"
      : range === "30d"
        ? "Your daily net profit for the last 30 days"
        : `Daily net profit, ${monthDayLabel(from)} to ${monthDayLabel(to)}`;

  return (
    <>
      <div className="hgrid">
        <Link className="sc hl" href="/sell">
          <div className="t">
            <div
              className="ci xs"
              style={{
                background: "color-mix(in srgb,var(--accent) 16%,#fff)",
                color: "var(--accent)",
              }}
            >
              <Icon name="coins" size={17} />
            </div>
            <span>Sales today</span>
            <Icon name="chevr" size={13} className="chev" />
          </div>
          <b className="v">{formatUGX(overview.sales_today)}</b>
          <TrendPill value={pctChange(overview.sales_today, overview.sales_yesterday)} suffix="vs yesterday" />
        </Link>
        <Link className="sc" href="/money">
          <div className="t">
            <div className="ci xs">
              <Icon name="wallet" size={17} />
            </div>
            <span>Spent today</span>
            <Icon name="chevr" size={13} className="chev" />
          </div>
          <b className="v">{formatUGX(overview.expenses_today)}</b>
          <TrendPill
            value={pctChange(overview.expenses_today, overview.expenses_yesterday)}
            suffix="vs yesterday"
            inverse
          />
        </Link>
        <Link className="sc" href="/analytics">
          <div className="t">
            <div className="ci xs">
              <Icon name="calendar" size={17} />
            </div>
            <span>Net this month</span>
            <Icon name="chevr" size={13} className="chev" />
          </div>
          <b className={`v ${overview.net_month < 0 ? "neg" : ""}`}>{formatUGX(overview.net_month)}</b>
          <TrendPill value={pctChange(overview.net_month, overview.net_prev_month)} suffix="vs last month" />
        </Link>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ci solid">
            <Icon name="bars" size={22} />
          </div>
          <div className="grow">
            <div className="ct">
              This month{" "}
              <span className="pill">
                {monthShort(`${month}-01`)} {month.slice(0, 4)}
              </span>
            </div>
            <small>
              {month === todayKey().slice(0, 7)
                ? "Your business performance this month"
                : `Your business performance in ${monthLongYear(month)}`}
            </small>
          </div>
          <label className="msel">
            <span>{monthLongYear(month).split(" ")[0]}</span>
            <Icon name="chevd" size={14} />
            <select
              value={month}
              aria-label="Choose month"
              onChange={(event) => {
                const search = new URLSearchParams({ range });
                if (range === "custom") {
                  search.set("from", from);
                  search.set("to", to);
                }
                router.push(`${basePath}?month=${event.target.value}&${search.toString()}`);
              }}
            >
              {monthOptions.map((option) => (
                <option value={option} key={option}>
                  {monthLongYear(option)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {[
          ["trend", "Sales", "", formatUGX(overview.month.sales), ""],
          ["coins", "Gross profit", "", formatUGX(overview.month.gross_profit), "pos"],
          [
            "tag",
            "Price reductions given",
            "Items sold below listed price",
            formatUGX(overview.month.price_reduction),
            "neg",
          ],
          ["plusc", "Other income", "", formatUGX(overview.month.other_income), ""],
          [
            "wallet",
            "Expenses",
            "Net profit leaves out stock purchases (already in cost of goods)",
            formatUGX(overview.month.expenses),
            "neg",
          ],
        ].map(([icon, label, small, value, className]) => (
          <div className="mr" key={label}>
            <div className="ci sm">
              <Icon name={icon as IconKey} size={18} />
            </div>
            <div className="grow">
              <b className="l">{label}</b>
              {small ? <small>{small}</small> : null}
            </div>
            <b className={`a ${className}`}>{value}</b>
          </div>
        ))}
      </div>

      <div className="bud">
        <div className="r1">
          <div className="ci w">
            <Icon name="wallet" size={22} />
          </div>
          <div className="grow">
            <b className="bt">Budget used</b>
            <small>
              {overview.budget.total
                ? `${formatUGX(overview.budget.spent)} of ${formatUGX(overview.budget.total)} used`
                : "No monthly budget set yet"}
            </small>
          </div>
          <Link className="vd" href="/money?tab=bud">
            {overview.budget.total ? "View Details" : "Set budget"} <Icon name="chevr" size={13} />
          </Link>
        </div>
        {overview.budget.total ? (
          <div className="r2">
            <div className="trk">
              <i
                className={budgetPercent > 100 ? "over" : ""}
                style={{ width: `${Math.min(100, budgetPercent)}%` }}
              />
            </div>
            <span className="pc">{Math.round(budgetPercent)}%</span>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="ch nw">
          <div className="ci solid">
            <Icon name="trend" size={20} />
          </div>
          <div className="grow">
            <div className="ct">Profit Trend (Daily)</div>
            <small>{subtitle}</small>
          </div>
          <div className="tog">
            {(
              [
                ["7d", "7D"],
                ["30d", "30D"],
                ["custom", "Custom"],
              ] as [HomeRange, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={range === key ? "on" : ""}
                onClick={() => setRange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {range === "custom" ? (
          <div className="dates">
            <input
              type="date"
              value={customFrom}
              max={todayKey()}
              aria-label="From date"
              onChange={(event) => applyCustomDates(event.target.value, customTo)}
            />
            <input
              type="date"
              value={customTo}
              max={todayKey()}
              aria-label="To date"
              onChange={(event) => applyCustomDates(customFrom, event.target.value)}
            />
          </div>
        ) : null}
        <ProfitBars days={days} vals={values} />
      </div>

      <div className="dp">
        <div className="ci solid">
          <Icon name="moneybag" size={22} />
        </div>
        <div className="grow">
          <b className="dt">Daily Profits</b>
          <small>Total net profit made today</small>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className={`big ${overview.net_today < 0 ? "neg" : ""}`}>
            {formatUGX(overview.net_today)}
          </div>
          <TrendPill value={pctChange(overview.net_today, overview.net_yesterday)} suffix="vs yesterday" />
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <div className="ci solid">
            <Icon name="swap" size={22} />
          </div>
          <div className="grow">
            <div className="ct">Recent Transactions</div>
            <small>Latest activity on your account</small>
          </div>
          <button type="button" className="seeall" onClick={() => setAllOpen(true)}>
            See All <Icon name="chevr" size={13} />
          </button>
        </div>
        <TransactionRows transactions={transactions.slice(0, 5)} />
      </div>

      {overview.low_stock.length ? (
        <div className="card">
          <div className="ch">
            <div className="ci solid">
              <Icon name="box" size={22} />
            </div>
            <div className="grow">
              <div className="ct">Low stock</div>
              <small>Items running out</small>
            </div>
          </div>
          {overview.low_stock.map((product) => (
            <div className="tx" key={product.id}>
              <Thumb product={product} />
              <div className="grow">
                <b className="l">{product.name}</b>
                <small>{product.stock} left</small>
              </div>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => {
                  setRestockTarget(product);
                  setRestockQty("");
                  setRestockCost(String(product.cost));
                  setRestockExpense(true);
                }}
              >
                Restock
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <BottomSheet open={allOpen} onClose={() => setAllOpen(false)} title="All transactions" subtitle="Latest 40 entries">
        <div style={{ marginTop: 8 }}>
          <TransactionRows transactions={transactions} />
        </div>
      </BottomSheet>

      <BottomSheet
        open={Boolean(restockTarget)}
        onClose={() => setRestockTarget(null)}
        title={restockTarget ? `Restock ${restockTarget.name}` : "Restock"}
        subtitle={restockTarget ? `Currently ${restockTarget.stock} in stock` : undefined}
      >
        <label htmlFor="h-rq">Quantity received</label>
        <input
          id="h-rq"
          type="number"
          inputMode="numeric"
          value={restockQty}
          onChange={(event) => setRestockQty(event.target.value)}
          placeholder="e.g. 10"
        />
        <label htmlFor="h-rc">New cost per item (optional)</label>
        <input
          id="h-rc"
          type="number"
          inputMode="numeric"
          value={restockCost}
          onChange={(event) => setRestockCost(event.target.value)}
        />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={restockExpense}
            onChange={(event) => setRestockExpense(event.target.checked)}
            style={{ width: "auto" }}
          />
          Also record as stock-purchase expense
        </label>
        <button className="btn" style={{ marginTop: 14 }} onClick={doRestock} disabled={restockBusy}>
          {restockBusy ? "Saving…" : "Save"}
        </button>
      </BottomSheet>
    </>
  );
}
