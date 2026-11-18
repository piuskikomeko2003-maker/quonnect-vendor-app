"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LineChart } from "@/components/charts/LineChart";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CollapsibleCard } from "@/components/ui/CollapsibleCard";
import { Icon } from "@/components/ui/Icon";
import { MoneyText } from "@/components/ui/MoneyText";
import { Thumb } from "@/components/ui/Thumb";
import {
  addDays,
  businessMonthKey,
  clampDateRange,
  formatMoney,
  formatNumber,
  monthDayLabel,
  todayKey,
  usDayLabel,
} from "@/lib/format";
import {
  MAX_CUSTOM_DAYS,
  PERIOD_NAMES,
  REPORTING_PERIODS,
  formatPeriodLabel,
  monthRange,
  periodPresets,
  sameRange,
  type PeriodPreset,
  type ReportingPeriod,
} from "@/lib/reporting-period";
import type { DashboardData, Transaction } from "@/lib/types";
import type { IconKey } from "@/lib/constants";
import type { Product } from "@/types/app-db";

const QUICK_ACTIONS: { label: string; icon: IconKey; href: string }[] = [
  { label: "Record Sale", icon: "cart", href: "/sell" },
  { label: "Add Expense", icon: "wallet", href: "/business?tab=money&add=expense" },
  { label: "Restock Inventory", icon: "box", href: "/stock" },
  { label: "Add Income", icon: "plusc", href: "/business?tab=money&add=income" },
  { label: "View Transactions", icon: "receipt", href: "/orders?tab=sales" },
];

const TX_ICONS: Record<string, IconKey> = {
  "Stock purchase": "box",
  Transport: "car",
  Food: "utensils",
  "Stall fee": "store",
  Packaging: "box",
  "Airtime/Data": "mobile",
};

const ACCOUNT_KIND_LABELS: Record<string, string> = {
  cash: "Physical cash",
  bank: "Bank account",
  mtn_momo: "Mobile money",
  airtel_money: "Mobile money",
  mobile_money: "Mobile money",
  savings: "Savings",
  other: "Other",
};

function accountKindIcon(kind: string): IconKey {
  if (kind === "cash") return "wallet";
  if (kind === "bank") return "moneybag";
  if (kind === "savings") return "coins";
  if (kind === "other") return "wallet";
  return "mobile";
}

function transactionIcon(transaction: Transaction): IconKey {
  if (transaction.kind === "sale") return "cart";
  if (transaction.kind === "income") return "plusc";
  return TX_ICONS[transaction.category] ?? "wallet";
}

function transactionSubtitle(transaction: Transaction): string {
  const date = usDayLabel(transaction.date);
  const time = transaction.ts
    ? new Date(transaction.ts).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const category =
    transaction.kind !== "sale" && transaction.category !== transaction.title
      ? `${transaction.category} · `
      : "";
  return `${category}${date}${time ? ` · ${time}` : ""}`;
}

function TransactionRows({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) return <div className="empty">No transactions in this period</div>;
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
              {transaction.amount >= 0 ? "+" : "−"}{" "}
              <MoneyText amount={Math.abs(transaction.amount)} className="inline-money" fit={false} />
            </b>
          </div>
        );
      })}
    </>
  );
}

function PeriodInputs({
  period,
  from,
  to,
  today,
  monthStartDay,
  onRange,
}: {
  period: ReportingPeriod;
  from: string;
  to: string;
  today: string;
  monthStartDay: number;
  onRange: (from: string, to: string) => void;
}) {
  if (period === "daily") {
    return (
      <div className="period-inputs one">
        <label>
          <span>Choose a date</span>
          <input
            type="date"
            value={from === to ? from : today}
            max={today}
            aria-label="Reporting date"
            onChange={(event) => onRange(event.target.value, event.target.value)}
          />
        </label>
      </div>
    );
  }

  if (period === "weekly") {
    return (
      <div className="period-inputs">
        <label>
          <span>From</span>
          <input
            type="date"
            value={from}
            max={to}
            aria-label="Week from date"
            onChange={(event) => onRange(event.target.value, to)}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            aria-label="Week to date"
            onChange={(event) => onRange(from, event.target.value)}
          />
        </label>
      </div>
    );
  }

  if (period === "monthly") {
    const selectedMonth = businessMonthKey(from, monthStartDay);
    const latestMonth = businessMonthKey(today, monthStartDay);
    return (
      <div className="period-inputs one">
        <label>
          <span>Choose a month</span>
          <input
            type="month"
            value={selectedMonth}
            max={latestMonth}
            aria-label="Reporting month"
            onChange={(event) => {
              if (!event.target.value) return;
              const range = monthRange(event.target.value, monthStartDay, today);
              onRange(range.from, range.to);
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="period-inputs">
      <label>
        <span>Start date</span>
        <input
          type="date"
          value={from}
          max={to}
          aria-label="Custom start date"
          onChange={(event) => onRange(event.target.value, to)}
        />
      </label>
      <label>
        <span>End date</span>
        <input
          type="date"
          value={to}
          min={from}
          max={today}
          aria-label="Custom end date"
          onChange={(event) => onRange(from, event.target.value)}
        />
      </label>
    </div>
  );
}

function PeriodSelector({
  period,
  from,
  to,
  today,
  monthStartDay,
  onPeriod,
  onRange,
}: {
  period: ReportingPeriod;
  from: string;
  to: string;
  today: string;
  monthStartDay: number;
  onPeriod: (period: ReportingPeriod) => void;
  onRange: (from: string, to: string) => void;
}) {
  const presets = periodPresets(period, today, monthStartDay);
  const active = presets.find((preset) => sameRange(preset, { from, to }));

  return (
    <section className="surface report-period" aria-label="Reporting period">
      <div className="surface-head">
        <span className="icon-circle">
          <Icon name="calendar" size={20} />
        </span>
        <div className="grow">
          <b className="surface-title">Reporting period</b>
          <small className="surface-sub">Every figure below uses this period</small>
        </div>
      </div>

      <div className="seg-pill period-tabs" role="group" aria-label="Reporting period type">
        {REPORTING_PERIODS.map((key) => (
          <button
            key={key}
            type="button"
            className={period === key ? "on" : ""}
            aria-pressed={period === key}
            onClick={() => onPeriod(key)}
          >
            {PERIOD_NAMES[key]}
          </button>
        ))}
      </div>

      {presets.length ? (
        <div className="period-presets" role="group" aria-label="Quick period options">
          {presets.map((preset: PeriodPreset) => (
            <button
              key={preset.key}
              type="button"
              className={`period-chip${active?.key === preset.key ? " on" : ""}`}
              aria-pressed={active?.key === preset.key}
              onClick={() => onRange(preset.from, preset.to)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}

      <PeriodInputs
        period={period}
        from={from}
        to={to}
        today={today}
        monthStartDay={monthStartDay}
        onRange={onRange}
      />

      <small className="period-summary">{formatPeriodLabel(from, to, today)}</small>
    </section>
  );
}

export function HomeScreen({
  data,
  products = [],
  period,
  today = todayKey(),
  monthStartDay = 1,
  customersEnabled = true,
  basePath = "",
}: {
  data: DashboardData;
  products?: Product[];
  period: ReportingPeriod;
  today?: string;
  monthStartDay?: number;
  customersEnabled?: boolean;
  basePath?: string;
}) {
  const router = useRouter();
  const { period: totals, current, daily, cash, categories, items, transactions } = data;
  const productList = Array.isArray(products) ? products : [];
  const accounts = current.accounts ?? [];
  const lowStock = data.low_stock ?? [];
  const [fundsOpen, setFundsOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  const homePath = basePath ? `${basePath}/home` : "/home";
  const periodName = formatPeriodLabel(totals.from, totals.to, today);

  const dailyRows = useMemo(
    () => [...daily].sort((a, b) => a.day.localeCompare(b.day)),
    [daily],
  );
  const cashRows = useMemo(() => [...cash].sort((a, b) => a.day.localeCompare(b.day)), [cash]);
  const chartLabels = dailyRows.map((row) => monthDayLabel(row.day));
  const cashLabels = cashRows.map((row) => monthDayLabel(row.day));
  const cashIn = cashRows.reduce((total, row) => total + row.cash_in, 0);
  const cashOut = cashRows.reduce((total, row) => total + row.cash_out, 0);
  const netCash = cashIn - cashOut;

  const expenseTotal = categories.reduce((total, row) => total + row.total, 0);
  const expenseMax = categories.length ? Math.max(...categories.map((row) => row.total)) : 0;
  const itemRevenue = (item: DashboardData["items"][number]) => Number(item.sold) * Number(item.actual);
  const bestSeller = items.reduce<DashboardData["items"][number] | null>(
    (best, item) => (Number(item.sold) > 0 && (!best || Number(item.sold) > Number(best.sold)) ? item : best),
    null,
  );
  const maxItemRevenue = items.reduce((max, item) => Math.max(max, itemRevenue(item)), 0);
  const margin = totals.sales ? (totals.net_profit / totals.sales) * 100 : null;

  const insights = useMemo(() => {
    const rows: { icon: IconKey; title: string; body: string }[] = [];

    if (bestSeller) {
      rows.push({
        icon: "trend",
        title: `Best seller: ${bestSeller.name}`,
        body: `${formatNumber(Number(bestSeller.sold))} sold · ${formatMoney(itemRevenue(bestSeller))} revenue`,
      });
    } else {
      rows.push({
        icon: "cart",
        title: "No sales in this period",
        body: "Record a sale or pick a wider reporting period.",
      });
    }

    if (categories.length) {
      const top = categories[0];
      rows.push({
        icon: "wallet",
        title: `Largest cost: ${top.category}`,
        body: `${formatMoney(top.total)} · ${expenseTotal ? Math.round((top.total / expenseTotal) * 100) : 0}% of period expenses`,
      });
    } else {
      rows.push({
        icon: "wallet",
        title: "No expenses recorded",
        body: "Expenses you add will appear here.",
      });
    }

    rows.push({
      icon: "moneybag",
      title:
        margin === null
          ? "Profit margin needs sales"
          : `${Math.round(margin)}% profit margin`,
      body:
        margin === null
          ? "Sales revenue is the base for this period."
          : `${formatMoney(totals.net_profit)} profit after stock cost and running costs.`,
    });

    return rows;
  }, [bestSeller, categories, expenseTotal, margin, totals.net_profit]);

  function pushRange(nextPeriod: ReportingPeriod, nextFrom: string, nextTo: string) {
    if (!nextFrom || !nextTo) return;
    const cappedTo = nextTo > today ? today : nextTo;
    const cappedFrom = nextFrom > cappedTo ? cappedTo : nextFrom;
    const clamped = clampDateRange(cappedFrom, cappedTo, MAX_CUSTOM_DAYS);
    const search = new URLSearchParams({
      period: nextPeriod,
      from: clamped.from,
      to: clamped.to,
    });
    router.push(`${homePath}?${search.toString()}`);
  }

  function setPeriod(next: ReportingPeriod) {
    const presets = periodPresets(next, today, monthStartDay);
    if (presets.length) {
      pushRange(next, presets[0].from, presets[0].to);
      return;
    }
    pushRange(next, addDays(today, -13), today);
  }

  const summaryCards = [
    {
      label: "Sales Revenue",
      amount: totals.sales,
      unit: periodName,
      href: `${basePath}/analytics`,
    },
    {
      label: "Expenses",
      amount: totals.expenses,
      unit: periodName,
      href: `${basePath}/business?tab=money`,
    },
    {
      label: "Profit",
      amount: totals.net_profit,
      unit: "after stock cost & running costs",
      href: `${basePath}/business?tab=analytics`,
    },
    {
      label: "Customer Outstanding Balances",
      amount: current.customer_outstanding,
      unit: "unpaid invoices · current",
      href: customersEnabled ? `${basePath}/business?tab=customers` : `${basePath}/orders`,
    },
    {
      label: "Stock Value",
      amount: current.stock_value,
      unit: `${formatNumber(current.stock_units)} units · current`,
      href: `${basePath}/stock`,
    },
  ];

  return (
    <>
      <div className="home dashboard">
        <PeriodSelector
          period={period}
          from={totals.from}
          to={totals.to}
          today={today}
          monthStartDay={monthStartDay}
          onPeriod={setPeriod}
          onRange={(from, to) => pushRange(period, from, to)}
        />

        <section className="funds-card" aria-label="Available Business Funds">
          <button
            type="button"
            className="funds-main"
            onClick={() => setFundsOpen(true)}
            aria-label="Available Business Funds. View account balances."
          >
            <span className="funds-label">
              <span className="icon-circle solid sm">
                <Icon name="wallet" size={18} />
              </span>
              Available Business Funds
              <Icon name="chevr" size={15} />
            </span>
            <MoneyText className="funds-value" amount={current.available_funds} />
            <span className="funds-meta">
              {accounts.length
                ? `${accounts.length} active business account${accounts.length === 1 ? "" : "s"} · tap to view`
                : "No business accounts yet"}
            </span>
          </button>
          <div className="funds-foot">
            Money available now. It does not change with the reporting period, and unpaid invoices
            and stock value are not included.
          </div>
        </section>

        <div className="quick-actions" role="list" aria-label="Quick actions">
          {QUICK_ACTIONS.map((action) => (
            <Link
              className="quick-action"
              key={action.label}
              href={`${basePath}${action.href}`}
              role="listitem"
            >
              <span className="quick-action-icon">
                <Icon name={action.icon} size={21} />
              </span>
              <span>{action.label}</span>
            </Link>
          ))}
        </div>

        <section className="stat-grid dashboard-stats" aria-label="Business summary">
          {summaryCards.map((card) => (
            <Link
              className={`stat-card${card.label === "Profit" ? " profit-card" : ""}`}
              key={card.label}
              href={card.href}
            >
              <span className="stat-label">{card.label}</span>
              <MoneyText
                className={`stat-value${card.amount < 0 ? " neg" : ""}`}
                amount={card.amount}
              />
              <span className="stat-unit">{card.unit}</span>
            </Link>
          ))}
        </section>

        <section className="period-details" aria-label="Period totals">
          <div>
            <small>Other income</small>
            <b>
              <MoneyText amount={totals.other_income} className="inline-money" fit={false} />
            </b>
          </div>
          <div>
            <small>Gross profit</small>
            <b>
              <MoneyText amount={totals.gross_profit} className="inline-money" fit={false} />
            </b>
          </div>
          <div>
            <small>Price reductions</small>
            <b>
              <MoneyText amount={totals.price_reduction} className="inline-money" fit={false} />
            </b>
          </div>
        </section>

        <section className="surface">
          <div className="surface-head">
            <span className="icon-circle">
              <Icon name="quote" size={20} />
            </span>
            <div className="grow">
              <b className="surface-title">Insights</b>
              <small className="surface-sub">What the numbers say · {periodName}</small>
            </div>
          </div>
          <div className="insight-list">
            {insights.map((insight) => (
              <div className="insight-item" key={insight.title}>
                <span className="icon-circle sm">
                  <Icon name={insight.icon} size={17} />
                </span>
                <div className="grow">
                  <b>{insight.title}</b>
                  <small>{insight.body}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="surface">
          <div className="surface-head">
            <span className="icon-circle">
              <Icon name="receipt" size={20} />
            </span>
            <div className="grow">
              <b className="surface-title">Transactions</b>
              <small className="surface-sub">
                {formatNumber(transactions.length)} entries · {periodName}
              </small>
            </div>
            <button type="button" className="text-link" onClick={() => setAllOpen(true)}>
              View all <Icon name="chevr" size={13} />
            </button>
          </div>
          <TransactionRows transactions={transactions.slice(0, 6)} />
        </section>

        <CollapsibleCard
          icon="trend"
          title="Sales trend"
          sub={`Revenue · ${periodName}`}
        >
          <LineChart
            key={`sales-${totals.from}-${totals.to}`}
            id="dashboard-sales"
            labels={chartLabels}
            ariaLabel={`Sales trend for ${periodName}`}
            series={[{ name: "Sales", color: "#1D4ED8", vals: dailyRows.map((row) => row.sales) }]}
          />
          <small className="surface-foot">
            {formatMoney(totals.sales)} from {formatNumber(totals.orders)} sale
            {totals.orders === 1 ? "" : "s"} · {formatNumber(totals.customers)} customer
            {totals.customers === 1 ? "" : "s"}
          </small>
        </CollapsibleCard>

        <CollapsibleCard
          icon="moneybag"
          title="Profit trend"
          sub={`Net profit · ${periodName}`}
        >
          <LineChart
            key={`profit-${totals.from}-${totals.to}`}
            id="dashboard-profit"
            labels={chartLabels}
            ariaLabel={`Profit trend for ${periodName}`}
            series={[
              { name: "Profit", color: "#0F766E", vals: dailyRows.map((row) => row.net_profit) },
            ]}
          />
          <small className="surface-foot">
            Profit = sales minus cost of goods, plus other income, minus running costs.
          </small>
        </CollapsibleCard>

        <CollapsibleCard
          icon="bars"
          title="Expense breakdown"
          sub={`Spending by category · ${periodName}`}
          right={
            <span className="pill">UGX {formatMoney(expenseTotal, { compact: true })}</span>
          }
        >
          {categories.length ? (
            <div className="expense-breakdown">
              {categories.map((row) => (
                <div className="expense-row" key={row.category}>
                  <div className="expense-row-head">
                    <b>{row.category}</b>
                    <span>
                      <MoneyText amount={row.total} className="inline-money" fit={false} /> ·{" "}
                      {expenseTotal ? Math.round((row.total / expenseTotal) * 100) : 0}%
                    </span>
                  </div>
                  <div className="bar">
                    <i
                      style={{
                        width: `${expenseMax ? (row.total / expenseMax) * 100 : 0}%`,
                        background: "#6B7F7A",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">No expenses in this period</div>
          )}
        </CollapsibleCard>

        <CollapsibleCard
          icon="swap"
          title="Cash movement"
          sub={`Money in and out · ${periodName}`}
        >
          <div className="chart-legend">
            <span>
              <i style={{ background: "#0F766E" }} /> Money in
            </span>
            <span>
              <i style={{ background: "#C2413B" }} /> Money out
            </span>
          </div>
          <LineChart
            key={`cash-${totals.from}-${totals.to}`}
            id="dashboard-cash"
            labels={cashLabels}
            ariaLabel={`Cash movement for ${periodName}`}
            series={[
              { name: "Money in", color: "#0F766E", vals: cashRows.map((row) => row.cash_in) },
              { name: "Money out", color: "#C2413B", vals: cashRows.map((row) => row.cash_out) },
            ]}
          />
          <div className="cash-summary">
            <span>
              <small>In</small>
              <b className="pos">
                +<MoneyText amount={cashIn} className="inline-money" fit={false} />
              </b>
            </span>
            <span>
              <small>Out</small>
              <b className="neg">
                −<MoneyText amount={cashOut} className="inline-money" fit={false} />
              </b>
            </span>
            <span>
              <small>Net</small>
              <b className={netCash < 0 ? "neg" : "pos"}>
                <MoneyText amount={netCash} className="inline-money" fit={false} />
              </b>
            </span>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          icon="box"
          title="Product performance"
          sub={`Top sellers · ${periodName}`}
        >
          {items.length ? (
            <div className="product-performance">
              {items.slice(0, 6).map((item) => {
                const revenue = itemRevenue(item);
                return (
                  <div className="performance-row" key={item.name}>
                    <div className="performance-head">
                      <b>{item.name}</b>
                      <span>
                        {formatNumber(Number(item.sold))} sold ·{" "}
                        <MoneyText amount={revenue} className="inline-money" fit={false} />
                      </span>
                    </div>
                    <div className="bar">
                      <i
                        style={{
                          width: `${maxItemRevenue ? (revenue / maxItemRevenue) * 100 : 0}%`,
                          background: "var(--accent)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">No product sales in this period</div>
          )}
        </CollapsibleCard>

        {lowStock.length ? (
          <section className="surface">
            <div className="surface-head">
              <span className="icon-circle">
                <Icon name="box" size={20} />
              </span>
              <div className="grow">
                <b className="surface-title">Low stock</b>
                <small className="surface-sub">Items running out · current</small>
              </div>
              <Link className="text-link" href={`${basePath}/stock`}>
                Open stock <Icon name="chevr" size={13} />
              </Link>
            </div>
            {lowStock.map((product) => (
              <div className="tx" key={product.id}>
                <Thumb product={product} />
                <div className="grow">
                  <b className="l">{product.name}</b>
                  <small>{product.stock} left</small>
                </div>
                <Link
                  className="btn sm ghost"
                  href={`${basePath}/stock?restock=${product.id}`}
                >
                  Restock
                </Link>
              </div>
            ))}
          </section>
        ) : null}

        <section className="surface">
          <div className="surface-head">
            <span className="icon-circle">
              <Icon name="box" size={20} />
            </span>
            <div className="grow">
              <b className="surface-title">My Products</b>
              <small className="surface-sub">Current items in your business</small>
            </div>
            <Link className="text-link" href={`${basePath}/stock`}>
              See all <Icon name="chevr" size={13} />
            </Link>
          </div>

          <div className="product-strip">
            <Link className="product-card add-product" href={`${basePath}/stock?add=1`}>
              <span className="add-product-icon">
                <Icon name="plus" size={24} />
              </span>
              <b>Add product</b>
              <small>Add a new item</small>
            </Link>
            {productList.slice(0, 10).map((product) => (
              <Link className="product-card" key={product.id} href={`${basePath}/stock`}>
                <Thumb product={product} className="product-card-image" />
                <b>{product.name}</b>
                <MoneyText amount={product.price} fit={false} />
                <small>{product.stock} in stock</small>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <BottomSheet
        open={fundsOpen}
        onClose={() => setFundsOpen(false)}
        title="Available Business Funds"
        subtitle="Current balance across active business accounts"
      >
        <div className="funds-sheet-total">
          <small>Available now</small>
          <MoneyText amount={current.available_funds} />
          <span>UGX · current, not period-based</span>
        </div>

        <div className="funds-account-list">
          {accounts.length ? (
            accounts.map((account) => (
              <div className="funds-account-row" key={account.id}>
                <span className="icon-circle sm">
                  <Icon name={accountKindIcon(account.kind)} size={17} />
                </span>
                <div className="grow">
                  <b>{account.name}</b>
                  <small>{ACCOUNT_KIND_LABELS[account.kind] ?? "Business account"}</small>
                </div>
                <MoneyText
                  amount={account.balance}
                  className={`inline-money${account.balance < 0 ? " neg" : ""}`}
                  fit={false}
                />
              </div>
            ))
          ) : (
            <div className="empty">No active business accounts</div>
          )}
        </div>

        <small className="funds-sheet-note">
          Balances come from money recorded against each account. Unpaid customer invoices and
          stock value are not available funds.
        </small>

        <Link className="btn" style={{ marginTop: 12 }} href={`${basePath}/accounts`}>
          Manage business accounts
        </Link>
      </BottomSheet>

      <BottomSheet
        open={allOpen}
        onClose={() => setAllOpen(false)}
        title="Transactions"
        subtitle={periodName}
      >
        <div style={{ marginTop: 8 }}>
          <TransactionRows transactions={transactions} />
        </div>
      </BottomSheet>

    </>
  );
}
