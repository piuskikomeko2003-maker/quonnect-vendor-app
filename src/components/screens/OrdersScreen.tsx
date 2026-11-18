"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { MoneyText } from "@/components/ui/MoneyText";
import { usDayLabel } from "@/lib/format";
import type { Transaction } from "@/lib/types";

export type OrderTab = "sales" | "bookings" | "messages";

const TABS: [OrderTab, string][] = [
  ["sales", "Sales"],
  ["bookings", "Bookings"],
  ["messages", "Messages"],
];

export function OrdersScreen({
  orders,
  initialTab = "sales",
}: {
  orders: Transaction[];
  initialTab?: OrderTab;
}) {
  const [tab, setTab] = useState<OrderTab>(initialTab);

  return (
    <>
      <div className="seg" role="tablist" aria-label="Order sections">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "on" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "sales" ? (
        orders.length ? (
          <div className="surface" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {orders.map((order) => (
              <div className="tx" key={order.id}>
                <div className="ci sm">
                  <Icon name="cart" size={18} />
                </div>
                <div className="grow">
                  <b className="l">
                    {order.items?.length
                      ? `Sale – ${order.items.slice(0, 2).join(", ")}`
                      : order.title}
                  </b>
                  <small>
                    {usDayLabel(order.date)}
                    {order.items?.length
                      ? ` · ${order.items.length} item${order.items.length === 1 ? "" : "s"}`
                      : ""}
                  </small>
                </div>
                <b className="a">
                  <MoneyText amount={order.amount} className="inline-money" fit={false} />
                </b>
              </div>
            ))}
          </div>
        ) : (
          <div className="surface">
            <div className="empty-state">
              <span className="icon-circle solid">
                <Icon name="orders" size={22} />
              </span>
              <b>No sales yet</b>
              <small>Record a sale and it will show up here.</small>
              <Link href="/sell" className="btn" style={{ marginTop: 4 }}>
                Record a sale
              </Link>
            </div>
          </div>
        )
      ) : null}

      {tab === "bookings" ? (
        <div className="surface">
          <div className="empty-state">
            <span className="icon-circle solid">
              <Icon name="calendar" size={22} />
            </span>
            <b>No upcoming bookings</b>
            <small>Bookings from customers will appear here once scheduling is enabled.</small>
          </div>
        </div>
      ) : null}

      {tab === "messages" ? (
        <div className="surface">
          <div className="empty-state">
            <span className="icon-circle solid">
              <Icon name="mail" size={22} />
            </span>
            <b>No customer messages yet</b>
            <small>Messages from customers will appear here once messaging is enabled.</small>
          </div>
        </div>
      ) : null}
    </>
  );
}
