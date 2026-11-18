"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  recordCustomerPaymentAction,
  recordSupplierPaymentAction,
} from "@/actions/settlements";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { MoneyText } from "@/components/ui/MoneyText";
import { Spinner } from "@/components/ui/Spinner";
import { SuccessSheet, type SuccessFact } from "@/components/ui/SuccessSheet";
import { useToast } from "@/components/ui/Toast";
import { accountKindLabel } from "@/lib/accounts";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatDay, todayKey } from "@/lib/format";
import { parseMoneyInput } from "@/lib/validation";
import {
  matchesSettlementHistory,
  newSettlementKey,
  settlementPaymentStatus,
  settlementTypeLabel,
  validateSettlementDrafts,
  type SettlementAllocationDraft,
} from "@/lib/settlements";
import type {
  AccountSummary,
  CustomerCollectionSummary,
  OutstandingCustomerSale,
  OutstandingSupplierPurchase,
  SettlementHistoryEntry,
  SettlementsData,
  SupplierPayableSummary,
} from "@/lib/types";

type SettlementTab = "customers" | "suppliers" | "history";

const TABS: [SettlementTab, string][] = [
  ["customers", "Customer collections"],
  ["suppliers", "Supplier payments"],
  ["history", "Settlement history"],
];

const HISTORY_TYPES: [string, string][] = [
  ["all", "All settlements"],
  ["customer_collection", "Customer collections"],
  ["supplier_payment", "Supplier payments"],
];

interface PaymentTarget {
  token: string;
  kind: "customer" | "supplier";
  customerId: string | null;
  partyName: string;
  rows: PaymentRow[];
}

interface PaymentRow {
  id: string;
  reference: string;
  date: string;
  total: number;
  paid: number;
  outstanding: number;
}

interface ConfirmationState {
  title: string;
  message: string;
  facts: SuccessFact[];
}

function preferredAccountId(accounts: AccountSummary[]): string {
  const active = accounts.filter((account) => account.is_active);
  return active.find((account) => account.kind === "cash")?.id ?? active[0]?.id ?? "";
}

function saleRows(sales: OutstandingCustomerSale[]): PaymentRow[] {
  return sales.map((sale) => ({
    id: sale.id,
    reference: sale.order_no || `Sale ${sale.id.slice(0, 8)}`,
    date: sale.sale_date,
    total: sale.total,
    paid: sale.paid_amount,
    outstanding: Math.max(0, sale.due_amount || sale.total - sale.paid_amount),
  }));
}

function purchaseRows(purchases: OutstandingSupplierPurchase[]): PaymentRow[] {
  return purchases.map((purchase) => ({
    id: purchase.id,
    reference: purchase.reference_no || `Purchase ${purchase.id.slice(0, 8)}`,
    date: purchase.purchase_date,
    total: purchase.total_amount,
    paid: purchase.paid_amount,
    outstanding: Math.max(0, purchase.due_amount || purchase.total_amount - purchase.paid_amount),
  }));
}

function StatusTag({ paid, total }: { paid: number; total: number }) {
  const status = settlementPaymentStatus(paid, total);
  return (
    <span
      className={`settlement-status ${status === "paid" ? "is-paid" : status === "partial" ? "is-partial" : "is-unpaid"}`}
    >
      {status === "paid" ? "Paid" : status === "partial" ? "Part paid" : "Unpaid"}
    </span>
  );
}

function SummaryStat({
  label,
  amount,
  note,
  tone,
  icon,
}: {
  label: string;
  amount: number;
  note: string;
  tone: "good" | "bad" | "plain";
  icon: "plusc" | "box" | "receipt";
}) {
  return (
    <div className={`money-stat ${tone}`}>
      <span className="money-stat-icon">
        <Icon name={icon} size={16} />
      </span>
      <small>{label}</small>
      <b>
        <MoneyText amount={amount} fit={false} />
      </b>
      <em>{note}</em>
    </div>
  );
}

function CustomerRow({
  customer,
  onOpen,
}: {
  customer: CustomerCollectionSummary;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="settlement-party-row" onClick={onOpen}>
      <span className="settlement-party-icon">
        <Icon name="user" size={17} />
      </span>
      <span className="grow">
        <b>{customer.customer_name}</b>
        <small>
          {customer.sale_count} unpaid sale{customer.sale_count === 1 ? "" : "s"}
          {customer.oldest_sale_date ? ` · oldest ${formatDay(customer.oldest_sale_date)}` : ""}
        </small>
        <small>
          {customer.last_payment_date
            ? `Last payment ${formatDay(customer.last_payment_date)}`
            : "No payment received yet"}
        </small>
      </span>
      <span className="settlement-party-amount">
        <MoneyText amount={customer.outstanding} className="inline-money" fit={false} />
        <Icon name="chevr" size={14} />
      </span>
    </button>
  );
}

function SupplierRow({
  supplier,
  onOpen,
}: {
  supplier: SupplierPayableSummary;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="settlement-party-row" onClick={onOpen}>
      <span className="settlement-party-icon is-supplier">
        <Icon name="box" size={17} />
      </span>
      <span className="grow">
        <b>{supplier.supplier_name}</b>
        <small>
          {supplier.purchase_count} unpaid purchase{supplier.purchase_count === 1 ? "" : "s"}
          {supplier.oldest_purchase_date
            ? ` · oldest ${formatDay(supplier.oldest_purchase_date)}`
            : ""}
        </small>
        <small>
          {supplier.last_payment_date
            ? `Last payment ${formatDay(supplier.last_payment_date)}`
            : "No payment made yet"}
        </small>
      </span>
      <span className="settlement-party-amount neg">
        <MoneyText amount={supplier.outstanding} className="inline-money" fit={false} />
        <Icon name="chevr" size={14} />
      </span>
    </button>
  );
}

export function SettlementsScreen({ data }: { data: SettlementsData }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<SettlementTab>("customers");
  const [customerKey, setCustomerKey] = useState<string | null>(null);
  const [supplierKey, setSupplierKey] = useState<string | null>(null);
  const [target, setTarget] = useState<PaymentTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const [historySearch, setHistorySearch] = useState("");
  const [historyType, setHistoryType] = useState("all");
  const [historyCustomer, setHistoryCustomer] = useState("all");
  const [historySupplier, setHistorySupplier] = useState("all");
  const [historyAccount, setHistoryAccount] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

  const selectedCustomer = data.customerCollections.find(
    (customer) => customer.customer_key === customerKey,
  );
  const selectedSupplier = data.supplierPayables.find(
    (supplier) => supplier.supplier_key === supplierKey,
  );

  const customerSales = useMemo(
    () => (customerKey ? data.customerSales.filter((sale) => sale.customer_key === customerKey) : []),
    [customerKey, data.customerSales],
  );
  const supplierPurchases = useMemo(
    () =>
      supplierKey
        ? data.supplierPurchases.filter((purchase) => purchase.supplier_key === supplierKey)
        : [],
    [supplierKey, data.supplierPurchases],
  );

  const customerParties = useMemo(
    () =>
      Array.from(
        new Set([
          ...data.customerCollections.map((customer) => customer.customer_name),
          ...data.history
            .filter((entry) => entry.settlement_type === "customer_collection")
            .map((entry) => entry.party_name),
        ]),
      ).sort(),
    [data.customerCollections, data.history],
  );

  const supplierParties = useMemo(
    () =>
      Array.from(
        new Set([
          ...data.supplierPayables.map((supplier) => supplier.supplier_name),
          ...data.history
            .filter((entry) => entry.settlement_type === "supplier_payment")
            .map((entry) => entry.party_name),
        ]),
      ).sort(),
    [data.history, data.supplierPayables],
  );

  const historyParty =
    historyCustomer !== "all" ? historyCustomer : historySupplier !== "all" ? historySupplier : "all";

  const filteredHistory = useMemo(
    () =>
      data.history.filter((entry) =>
        matchesSettlementHistory(entry, {
          search: historySearch,
          type: historyType,
          party: historyParty,
          accountId: historyAccount,
          from: historyFrom,
          to: historyTo,
        }),
      ),
    [
      data.history,
      historySearch,
      historyType,
      historyParty,
      historyAccount,
      historyFrom,
      historyTo,
    ],
  );

  const hasHistoryFilters =
    Boolean(historySearch || historyFrom || historyTo) ||
    historyType !== "all" ||
    historyCustomer !== "all" ||
    historySupplier !== "all" ||
    historyAccount !== "all";

  function openCustomerPayment(customer: CustomerCollectionSummary | undefined) {
    if (!customer) return;
    const rows = saleRows(
      data.customerSales.filter((sale) => sale.customer_key === customer.customer_key),
    );
    if (!rows.length) {
      toast("This customer has no outstanding sales");
      return;
    }
    setPaymentError("");
    setTarget({
      token: newSettlementKey(),
      kind: "customer",
      customerId: customer.customer_id,
      partyName: customer.customer_name,
      rows,
    });
  }

  function openSupplierPayment(supplier: SupplierPayableSummary | undefined) {
    if (!supplier) return;
    const rows = purchaseRows(
      data.supplierPurchases.filter((purchase) => purchase.supplier_key === supplier.supplier_key),
    );
    if (!rows.length) {
      toast("This supplier has no outstanding purchases");
      return;
    }
    setPaymentError("");
    setTarget({
      token: newSettlementKey(),
      kind: "supplier",
      customerId: null,
      partyName: supplier.supplier_name,
      rows,
    });
  }

  function done(result: Awaited<ReturnType<typeof recordCustomerPaymentAction>>) {
    if (!result.ok || !result.payment) {
      setPaymentError(result.error ?? "Could not save this payment");
      return;
    }

    const payment = result.payment;
    const facts: SuccessFact[] = [
      { label: "Paid by", value: payment.party_name },
      {
        label: payment.settlement_type === "customer_collection" ? "Amount received" : "Amount paid",
        value: <MoneyText amount={payment.total} className="inline-money" fit={false} />,
        tone: payment.settlement_type === "customer_collection" ? "pos" : "neg",
      },
      {
        label: payment.settlement_type === "customer_collection" ? "Received into" : "Paid from",
        value: payment.account_name ?? "Selected account",
      },
      {
        label: "Outstanding after",
        value:
          payment.party_outstanding_after == null ? (
            "Updated"
          ) : (
            <MoneyText amount={payment.party_outstanding_after} className="inline-money" fit={false} />
          ),
      },
      ...(payment.account_balance_after !== null
        ? [
            {
              label: "Updated account balance",
              value: (
                <MoneyText
                  amount={payment.account_balance_after}
                  className="inline-money"
                  fit={false}
                />
              ),
            },
          ]
        : []),
    ];

    setTarget(null);
    setPaymentError("");
    setConfirmation({
      title: payment.duplicate ? "Payment already recorded" : "Payment recorded",
      message: payment.duplicate
        ? "This payment was saved earlier. No account balance or outstanding balance was changed twice."
        : payment.settlement_type === "customer_collection"
          ? "The customer's outstanding sales and the receiving account are now updated. This is a settlement, not a new sale."
          : "The supplier's outstanding purchases and the paying account are now updated. This is a settlement, not a new stock purchase.",
      facts,
    });
    setCustomerKey(null);
    setSupplierKey(null);
    router.refresh();
  }

  async function submitPayment(input: {
    allocations: { id: string; amount: number }[];
    accountId: string;
    paymentMethod: string;
    reference: string;
    paidOn: string;
    idempotencyKey: string;
  }) {
    if (!target) return;
    setBusy(true);

    const result =
      target.kind === "customer"
        ? await recordCustomerPaymentAction({
            customer_id: target.customerId,
            customer_name: target.partyName,
            allocations: input.allocations.map((allocation) => ({
              sale_id: allocation.id,
              amount: allocation.amount,
            })),
            payment_method: input.paymentMethod,
            account_id: input.accountId,
            reference: input.reference,
            paid_on: input.paidOn,
            idempotency_key: input.idempotencyKey,
          })
        : await recordSupplierPaymentAction({
            supplier_name: target.partyName,
            allocations: input.allocations.map((allocation) => ({
              purchase_id: allocation.id,
              amount: allocation.amount,
            })),
            account_id: input.accountId,
            reference: input.reference,
            paid_on: input.paidOn,
            idempotency_key: input.idempotencyKey,
          });

    setBusy(false);
    done(result);
  }

  function clearHistoryFilters() {
    setHistorySearch("");
    setHistoryType("all");
    setHistoryCustomer("all");
    setHistorySupplier("all");
    setHistoryAccount("all");
    setHistoryFrom("");
    setHistoryTo("");
  }

  return (
    <>
      <nav className="money-nav settlement-nav" aria-label="Settlement sections">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? "on" : ""}
            aria-current={tab === key ? "page" : undefined}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "customers" ? (
        selectedCustomer ? (
          <>
            <button type="button" className="link settlement-back" onClick={() => setCustomerKey(null)}>
              ← All customers
            </button>
            <section className="surface settlement-detail-head">
              <div className="surface-head">
                <span className="icon-circle">
                  <Icon name="user" size={19} />
                </span>
                <div className="grow">
                  <b className="surface-title">{selectedCustomer.customer_name}</b>
                  <small className="surface-sub">
                    {selectedCustomer.sale_count} outstanding sale
                    {selectedCustomer.sale_count === 1 ? "" : "s"}
                    {selectedCustomer.customer_phone
                      ? ` · ${selectedCustomer.customer_phone}`
                      : ""}
                  </small>
                </div>
              </div>
              <div className="settlement-detail-total">
                <small>Total outstanding</small>
                <MoneyText amount={selectedCustomer.outstanding} />
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => openCustomerPayment(selectedCustomer)}
              >
                <Icon name="plusc" size={15} /> Record customer payment
              </button>
            </section>

            <div className="card">
              <h3>Outstanding sales</h3>
              <p className="money-card-note">
                Payments here settle sales that were already recorded. They do not create new
                revenue.
              </p>
              {customerSales.length ? (
                <div className="settlement-detail-list">
                  {customerSales.map((sale) => (
                    <div className="settlement-detail-row" key={sale.id}>
                      <div className="grow">
                        <b>{sale.order_no || `Sale ${sale.id.slice(0, 8)}`}</b>
                        <small>
                          {formatDay(sale.sale_date)} · Total{" "}
                          <MoneyText amount={sale.total} className="inline-money" fit={false} />
                        </small>
                        <small>
                          Paid <MoneyText amount={sale.paid_amount} className="inline-money" fit={false} />
                        </small>
                      </div>
                      <div className="settlement-detail-side">
                        <StatusTag paid={sale.paid_amount} total={sale.total} />
                        <b className="neg">
                          <MoneyText amount={sale.due_amount} className="inline-money" fit={false} />
                        </b>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <b>No outstanding sales</b>
                  <small>This customer is fully settled.</small>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="money-stat-grid">
              <SummaryStat
                label="Owed by customers"
                amount={data.customerOutstanding}
                note={`${data.customerCollections.length} customer${data.customerCollections.length === 1 ? "" : "s"}`}
                tone={data.customerOutstanding > 0 ? "good" : "plain"}
                icon="plusc"
              />
              <SummaryStat
                label="Owed to suppliers"
                amount={data.supplierOutstanding}
                note={`${data.supplierPayables.length} supplier${data.supplierPayables.length === 1 ? "" : "s"}`}
                tone={data.supplierOutstanding > 0 ? "bad" : "plain"}
                icon="box"
              />
            </div>

            <section className="surface">
              <div className="surface-head">
                <span className="icon-circle">
                  <Icon name="coins" size={20} />
                </span>
                <div className="grow">
                  <b className="surface-title">Customer collections</b>
                  <small className="surface-sub">Money customers still owe your business</small>
                </div>
              </div>

              {data.customerCollections.length ? (
                <div className="settlement-party-list">
                  {data.customerCollections.map((customer) => (
                    <CustomerRow
                      key={customer.customer_key}
                      customer={customer}
                      onOpen={() => setCustomerKey(customer.customer_key)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="check"
                  title="No outstanding customer balances"
                  description="Every recorded sale has been fully paid. New unpaid or partial sales will appear here automatically."
                />
              )}
            </section>
          </>
        )
      ) : null}

      {tab === "suppliers" ? (
        selectedSupplier ? (
          <>
            <button type="button" className="link settlement-back" onClick={() => setSupplierKey(null)}>
              ← All suppliers
            </button>
            <section className="surface settlement-detail-head">
              <div className="surface-head">
                <span className="icon-circle">
                  <Icon name="box" size={19} />
                </span>
                <div className="grow">
                  <b className="surface-title">{selectedSupplier.supplier_name}</b>
                  <small className="surface-sub">
                    {selectedSupplier.purchase_count} outstanding purchase
                    {selectedSupplier.purchase_count === 1 ? "" : "s"}
                  </small>
                </div>
              </div>
              <div className="settlement-detail-total">
                <small>Total you owe</small>
                <MoneyText amount={selectedSupplier.outstanding} />
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => openSupplierPayment(selectedSupplier)}
              >
                <Icon name="moneybag" size={15} /> Record supplier payment
              </button>
            </section>

            <div className="card">
              <h3>Outstanding purchases</h3>
              <p className="money-card-note">
                Paying these purchases settles an existing supplier bill. Stock and purchase
                expenses are not recorded again.
              </p>
              {supplierPurchases.length ? (
                <div className="settlement-detail-list">
                  {supplierPurchases.map((purchase) => (
                    <div className="settlement-detail-row" key={purchase.id}>
                      <div className="grow">
                        <b>{purchase.reference_no || `Purchase ${purchase.id.slice(0, 8)}`}</b>
                        <small>
                          {formatDay(purchase.purchase_date)} · Total{" "}
                          <MoneyText
                            amount={purchase.total_amount}
                            className="inline-money"
                            fit={false}
                          />
                        </small>
                        <small>
                          Paid{" "}
                          <MoneyText amount={purchase.paid_amount} className="inline-money" fit={false} />
                        </small>
                      </div>
                      <div className="settlement-detail-side">
                        <StatusTag paid={purchase.paid_amount} total={purchase.total_amount} />
                        <b className="neg">
                          <MoneyText amount={purchase.due_amount} className="inline-money" fit={false} />
                        </b>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <b>No outstanding purchases</b>
                  <small>This supplier is fully paid.</small>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="money-stat-grid">
              <SummaryStat
                label="Owed to suppliers"
                amount={data.supplierOutstanding}
                note={`${data.supplierPayables.length} supplier${data.supplierPayables.length === 1 ? "" : "s"}`}
                tone={data.supplierOutstanding > 0 ? "bad" : "plain"}
                icon="box"
              />
              <SummaryStat
                label="Owed by customers"
                amount={data.customerOutstanding}
                note={`${data.customerCollections.length} customer${data.customerCollections.length === 1 ? "" : "s"}`}
                tone={data.customerOutstanding > 0 ? "good" : "plain"}
                icon="plusc"
              />
            </div>

            <section className="surface">
              <div className="surface-head">
                <span className="icon-circle">
                  <Icon name="box" size={20} />
                </span>
                <div className="grow">
                  <b className="surface-title">Supplier payments</b>
                  <small className="surface-sub">Money your business still owes suppliers</small>
                </div>
              </div>

              {data.supplierPayables.length ? (
                <div className="settlement-party-list">
                  {data.supplierPayables.map((supplier) => (
                    <SupplierRow
                      key={supplier.supplier_key}
                      supplier={supplier}
                      onOpen={() => setSupplierKey(supplier.supplier_key)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="check"
                  title="No outstanding supplier bills"
                  description="Every recorded purchase has been fully paid. Credit and partial purchases will appear here automatically."
                />
              )}
            </section>
          </>
        )
      ) : null}

      {tab === "history" ? (
        <>
          <section className="surface money-filters" aria-label="Settlement history filters">
            <div className="money-search">
              <Icon name="receipt" size={16} />
              <input
                type="search"
                value={historySearch}
                placeholder="Search reference, customer, supplier or account"
                aria-label="Search settlement history"
                onChange={(event) => setHistorySearch(event.target.value)}
              />
            </div>
            <div className="money-filter-grid">
              <div>
                <label htmlFor="sh-type">Transaction type</label>
                <select
                  id="sh-type"
                  value={historyType}
                  onChange={(event) => setHistoryType(event.target.value)}
                >
                  {HISTORY_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sh-customer">Customer</label>
                <select
                  id="sh-customer"
                  value={historyCustomer}
                  onChange={(event) => {
                    setHistoryCustomer(event.target.value);
                    if (event.target.value !== "all") setHistorySupplier("all");
                  }}
                >
                  <option value="all">All customers</option>
                  {customerParties.map((party) => (
                    <option key={party} value={party}>
                      {party}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sh-supplier">Supplier</label>
                <select
                  id="sh-supplier"
                  value={historySupplier}
                  onChange={(event) => {
                    setHistorySupplier(event.target.value);
                    if (event.target.value !== "all") setHistoryCustomer("all");
                  }}
                >
                  <option value="all">All suppliers</option>
                  {supplierParties.map((party) => (
                    <option key={party} value={party}>
                      {party}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sh-account">Business account</label>
                <select
                  id="sh-account"
                  value={historyAccount}
                  onChange={(event) => setHistoryAccount(event.target.value)}
                >
                  <option value="all">All accounts</option>
                  {data.accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sh-from">From</label>
                <input
                  id="sh-from"
                  type="date"
                  max={historyTo || todayKey()}
                  value={historyFrom}
                  onChange={(event) => setHistoryFrom(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="sh-to">To</label>
                <input
                  id="sh-to"
                  type="date"
                  min={historyFrom || undefined}
                  max={todayKey()}
                  value={historyTo}
                  onChange={(event) => setHistoryTo(event.target.value)}
                />
              </div>
            </div>
            <div className="money-filter-foot">
              <small>
                {filteredHistory.length} settlement
                {filteredHistory.length === 1 ? "" : "s"}
              </small>
              {hasHistoryFilters ? (
                <button type="button" className="link" onClick={clearHistoryFilters}>
                  Clear filters
                </button>
              ) : null}
            </div>
          </section>

          <div className="card">
            {filteredHistory.length ? (
              <div className="account-movements">
                {filteredHistory.map((entry) => (
                  <HistoryRow key={entry.id} entry={entry} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="receipt"
                title={hasHistoryFilters ? "No settlements match these filters" : "No settlements yet"}
                description={
                  hasHistoryFilters
                    ? "Try a different customer, supplier, account or date range."
                    : "Customer collections and supplier payments will appear here after they are recorded."
                }
                actionLabel={hasHistoryFilters ? "Clear filters" : undefined}
                onAction={hasHistoryFilters ? clearHistoryFilters : undefined}
              />
            )}
          </div>
        </>
      ) : null}

      <PaymentSheet
        key={target?.token ?? "settlement-sheet-closed"}
        open={Boolean(target)}
        target={target}
        accounts={data.accounts}
        busy={busy}
        error={paymentError}
        onClose={() => {
          if (!busy) setTarget(null);
        }}
        onSubmit={submitPayment}
      />

      <SuccessSheet
        open={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        title={confirmation?.title ?? "Saved"}
        message={confirmation?.message}
        facts={confirmation?.facts ?? []}
      />
    </>
  );
}

function HistoryRow({ entry }: { entry: SettlementHistoryEntry }) {
  const incoming = entry.settlement_type === "customer_collection";
  const references = entry.allocations
    .map((allocation) => allocation.reference_no)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="account-movement settlement-history-row">
      <span className={`account-movement-icon ${incoming ? "in" : "out"}`}>
        <Icon name={incoming ? "plusc" : "box"} size={16} />
      </span>
      <div className="grow">
        <b>
          {entry.party_name}
          <span className="settlement-type-tag">{settlementTypeLabel(entry.settlement_type)}</span>
        </b>
        <small>
          {formatDay(entry.paid_on)} · {entry.account_name}
          {entry.reference ? ` · Ref ${entry.reference}` : ""}
        </small>
        {references ? <small>{references}</small> : null}
        <span className="settlement-history-status">Completed</span>
      </div>
      <b className={`account-amount ${incoming ? "pos" : "neg"}`}>
        {incoming ? "+" : "−"}
        <MoneyText amount={entry.amount} className="inline-money" fit={false} />
      </b>
    </div>
  );
}

function PaymentSheet({
  open,
  target,
  accounts,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  target: PaymentTarget | null;
  accounts: AccountSummary[];
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (input: {
    allocations: { id: string; amount: number }[];
    accountId: string;
    paymentMethod: string;
    reference: string;
    paidOn: string;
    idempotencyKey: string;
  }) => Promise<void>;
}) {
  const activeAccounts = accounts.filter((account) => account.is_active);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [accountId, setAccountId] = useState(preferredAccountId(accounts));
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(todayKey());
  const [idempotencyKey] = useState(() => newSettlementKey());
  const [localError, setLocalError] = useState("");

  const rows = target?.rows ?? [];
  const selectedRows = rows.filter((row) => selected[row.id]);
  const total = selectedRows.reduce(
    (sum, row) => sum + (parseMoneyInput(amounts[row.id]) ?? 0),
    0,
  );

  function toggle(row: PaymentRow, checked: boolean) {
    setSelected((current) => ({ ...current, [row.id]: checked }));
    setAmounts((current) => ({
      ...current,
      [row.id]: checked && !current[row.id] ? String(row.outstanding) : current[row.id] ?? "",
    }));
    setLocalError("");
  }

  function settleAll() {
    const nextSelected: Record<string, boolean> = {};
    const nextAmounts: Record<string, string> = {};
    rows.forEach((row) => {
      nextSelected[row.id] = true;
      nextAmounts[row.id] = String(row.outstanding);
    });
    setSelected(nextSelected);
    setAmounts(nextAmounts);
    setLocalError("");
  }

  function submit() {
    const drafts: SettlementAllocationDraft[] = selectedRows.map((row) => ({
      id: row.id,
      outstanding: row.outstanding,
      amount: amounts[row.id] ?? "",
    }));
    const validated = validateSettlementDrafts(drafts);
    if (!validated.ok) {
      setLocalError(validated.error ?? "Check the payment amounts");
      return;
    }
    if (!accountId) {
      setLocalError(
        activeAccounts.length
          ? "Choose a business account"
          : "Add an active business account before recording this payment",
      );
      return;
    }
    setLocalError("");
    onSubmit({
      allocations: validated.allocations,
      accountId,
      paymentMethod,
      reference,
      paidOn,
      idempotencyKey,
    });
  }

  if (!target) return null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={target.kind === "customer" ? "Record customer payment" : "Record supplier payment"}
      subtitle={
        target.kind === "customer"
          ? `Money received from ${target.partyName}`
          : `Money paid to ${target.partyName}`
      }
    >
      <div className="settlement-sheet-actions">
        <span>
          {selectedRows.length} selected ·{" "}
          <b>
            <MoneyText amount={total} className="inline-money" fit={false} />
          </b>
        </span>
        <button type="button" className="link" onClick={settleAll}>
          Pay all in full
        </button>
      </div>

      <div className="settlement-allocations">
        {rows.map((row) => {
          const status = settlementPaymentStatus(row.paid, row.total);
          const checked = Boolean(selected[row.id]);
          return (
            <div className={`settlement-allocation ${checked ? "is-selected" : ""}`} key={row.id}>
              <label className="settlement-allocation-check">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggle(row, event.target.checked)}
                />
                <span className="grow">
                  <b>{row.reference}</b>
                  <small>
                    {formatDay(row.date)} · {status === "partial" ? "Part paid" : "Unpaid"}
                  </small>
                  <small>
                    Outstanding{" "}
                    <MoneyText amount={row.outstanding} className="inline-money" fit={false} />
                  </small>
                </span>
              </label>
              <div className="settlement-allocation-input">
                <label htmlFor={`settle-${row.id}`}>Amount</label>
                <input
                  id={`settle-${row.id}`}
                  type="text"
                  inputMode="numeric"
                  value={amounts[row.id] ?? ""}
                  placeholder="0"
                  disabled={!checked}
                  onChange={(event) => {
                    setAmounts((current) => ({ ...current, [row.id]: event.target.value }));
                    setLocalError("");
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <label htmlFor="settle-account">
        {target.kind === "customer" ? "Received into" : "Paid from"}
      </label>
      {activeAccounts.length ? (
        <select
          id="settle-account"
          value={accountId}
          onChange={(event) => {
            setAccountId(event.target.value);
            setLocalError("");
          }}
        >
          {activeAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {accountKindLabel(account.kind)}
            </option>
          ))}
        </select>
      ) : (
        <div className="money-account-fallback">
          No active business account. Add one before recording this payment.
        </div>
      )}

      {target.kind === "customer" ? (
        <>
          <label htmlFor="settle-method">Payment method</label>
          <select
            id="settle-method"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <label htmlFor="settle-date">Date</label>
      <input
        id="settle-date"
        type="date"
        max={todayKey()}
        value={paidOn}
        onChange={(event) => setPaidOn(event.target.value)}
      />

      <label htmlFor="settle-reference">Payment reference (optional)</label>
      <input
        id="settle-reference"
        value={reference}
        placeholder="e.g. Receipt or mobile money reference"
        maxLength={120}
        onChange={(event) => setReference(event.target.value)}
      />

      <p className="settlement-sheet-note">
        {target.kind === "customer"
          ? "This reduces the customer's outstanding balance and increases the selected account. It does not create new sales revenue."
          : "This reduces the supplier's outstanding balance and the selected account. It does not record the stock purchase expense again."}
      </p>

      <div className="err" role="alert">
        {localError || error || ""}
      </div>
      <button
        type="button"
        className="btn"
        style={{ marginTop: 6 }}
        disabled={busy}
        aria-busy={busy ? "true" : undefined}
        onClick={submit}
      >
        {busy ? (
          <>
            <Spinner /> Saving…
          </>
        ) : target.kind === "customer" ? (
          "Save customer payment"
        ) : (
          "Save supplier payment"
        )}
      </button>
    </BottomSheet>
  );
}
