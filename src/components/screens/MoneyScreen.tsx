"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addExpenseAction,
  addIncomeAction,
  reverseFinanceEntryAction,
  setBudgetAction,
  updateExpenseAction,
} from "@/actions/business";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { MoneyText } from "@/components/ui/MoneyText";
import { Spinner } from "@/components/ui/Spinner";
import { SuccessSheet, type SuccessFact } from "@/components/ui/SuccessSheet";
import { useToast } from "@/components/ui/Toast";
import { accountIcon, accountKindLabel } from "@/lib/accounts";
import { EXPENSE_FREQUENCIES, type ExpenseFrequency, type IconKey } from "@/lib/constants";
import { formatDay, todayKey } from "@/lib/format";
import { budgetProgress, matchesMoneyTransaction } from "@/lib/money";
import { parseMoneyInput, validateMoneyEntry } from "@/lib/validation";
import type { AccountSummary, MoneyData, MoneyTransaction } from "@/lib/types";
import type { Budget, FinanceEntry } from "@/types/app-db";

type MoneyTab = "overview" | "accounts" | "exp" | "inc" | "bud" | "tx";

const TABS: [MoneyTab, string][] = [
  ["overview", "Overview"],
  ["accounts", "Accounts"],
  ["exp", "Expenses"],
  ["inc", "Other income"],
  ["bud", "Budgets"],
  ["tx", "Transactions"],
];

const TRANSACTION_KINDS: [string, string][] = [
  ["all", "All types"],
  ["sale", "Sales"],
  ["expense", "Expenses"],
  ["income", "Other income"],
  ["transfer", "Transfers"],
];

const TRANSACTION_ICONS: Record<MoneyTransaction["kind"], IconKey> = {
  sale: "receipt",
  expense: "cart",
  income: "plusc",
  transfer: "swap",
};

interface ExpenseValues {
  category: string;
  amount: number;
  note: string;
  frequency: ExpenseFrequency;
  entry_date: string;
  account_id: string | null;
}

interface ConfirmationState {
  title: string;
  message: string;
  facts: SuccessFact[];
  warning?: string;
}

function preferredAccountId(accounts: AccountSummary[]): string {
  const active = accounts.filter((account) => account.is_active);
  return active.find((account) => account.kind === "cash")?.id ?? active[0]?.id ?? "";
}

function accountName(accounts: AccountSummary[], id: string | null | undefined): string {
  if (!id) return "";
  return accounts.find((account) => account.id === id)?.name ?? "";
}

function financeFacts(
  entry: {
    category: string;
    amount: number;
    entry_date: string;
    account_name: string | null;
    account_balance_after: number | null;
  },
  direction: "expense" | "income",
): SuccessFact[] {
  const facts: SuccessFact[] = [
    { label: "Category", value: entry.category },
    {
      label: direction === "expense" ? "Amount deducted" : "Amount received",
      value: <MoneyText amount={entry.amount} className="inline-money" fit={false} />,
      tone: direction === "expense" ? "neg" : "pos",
    },
    {
      label: direction === "expense" ? "Paid from" : "Received into",
      value: entry.account_name ?? "Cash (default account)",
    },
  ];

  if (entry.account_balance_after !== null) {
    facts.push({
      label: "Updated account balance",
      value: (
        <MoneyText amount={entry.account_balance_after} className="inline-money" fit={false} />
      ),
    });
  }

  facts.push({ label: "Date", value: formatDay(entry.entry_date) });
  return facts;
}

function CategoryPicker({
  id,
  label,
  value,
  options,
  placeholder,
  help,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  help?: string;
  onChange: (value: string) => void;
}) {
  const listId = `${id}-options`;
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        list={listId}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={listId}>
        {options.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      {help ? <small className="field-help">{help}</small> : null}
    </>
  );
}

function AccountPicker({
  id,
  label,
  accounts,
  value,
  onChange,
}: {
  id: string;
  label: string;
  accounts: AccountSummary[];
  value: string;
  onChange: (value: string) => void;
}) {
  const active = accounts.filter((account) => account.is_active);
  if (!active.length) {
    return (
      <>
        <label>{label}</label>
        <div className="money-account-fallback">Cash (your default account)</div>
      </>
    );
  }

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {active.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
    </>
  );
}

function MoneyStat({
  label,
  amount,
  note,
  tone = "plain",
  icon,
}: {
  label: string;
  amount: number;
  note?: string;
  tone?: "plain" | "good" | "bad" | "warn";
  icon: IconKey;
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
      {note ? <em>{note}</em> : null}
    </div>
  );
}

export function MoneyScreen({
  data,
  initialTab = "overview",
  initialAdd = null,
}: {
  data: MoneyData;
  initialTab?: MoneyTab;
  initialAdd?: "expense" | "income" | "budget" | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<MoneyTab>(initialTab);
  const [expenseOpen, setExpenseOpen] = useState(initialAdd === "expense");
  const [expenseError, setExpenseError] = useState("");
  const [editingExpense, setEditingExpense] = useState<FinanceEntry | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(initialAdd === "income");
  const [incomeError, setIncomeError] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(initialAdd === "budget");
  const [budgetError, setBudgetError] = useState("");
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [reverseTarget, setReverseTarget] = useState<FinanceEntry | null>(null);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [reverseError, setReverseError] = useState("");

  const [txSearch, setTxSearch] = useState("");
  const [txKind, setTxKind] = useState("all");
  const [txAccount, setTxAccount] = useState("all");
  const [txCategory, setTxCategory] = useState("all");
  const [txFrom, setTxFrom] = useState("");
  const [txTo, setTxTo] = useState("");

  const overview = data.overview;
  const activeAccounts = useMemo(
    () => data.accounts.filter((account) => account.is_active),
    [data.accounts],
  );
  const transactionCategories = useMemo(
    () => [...new Set(data.transactions.map((transaction) => transaction.category))].sort(),
    [data.transactions],
  );
  const filteredTransactions = useMemo(
    () =>
      data.transactions.filter((transaction) =>
        matchesMoneyTransaction(transaction, {
          search: txSearch,
          kind: txKind,
          accountId: txAccount,
          category: txCategory,
          from: txFrom,
          to: txTo,
        }),
      ),
    [data.transactions, txSearch, txKind, txAccount, txCategory, txFrom, txTo],
  );
  const hasTxFilters =
    Boolean(txSearch || txFrom || txTo) ||
    txKind !== "all" ||
    txAccount !== "all" ||
    txCategory !== "all";

  const budgetTotals = useMemo(
    () =>
      data.budgets.reduce(
        (total, budget) => {
          const progress = budgetProgress(
            budget.monthly_limit,
            data.spentByCategory[budget.category] || 0,
          );
          return {
            budgeted: total.budgeted + progress.limit,
            spent: total.spent + progress.spent,
          };
        },
        { budgeted: 0, spent: 0 },
      ),
    [data.budgets, data.spentByCategory],
  );
  const totalBudgetProgress = budgetProgress(budgetTotals.budgeted, budgetTotals.spent);

  function openExpense(entry: FinanceEntry | null = null) {
    setExpenseError("");
    setEditingExpense(entry);
    setExpenseOpen(true);
  }

  function openBudget(budget: Budget | null = null) {
    setBudgetError("");
    setEditingBudget(budget);
    setBudgetOpen(true);
  }

  function clearTxFilters() {
    setTxSearch("");
    setTxKind("all");
    setTxAccount("all");
    setTxCategory("all");
    setTxFrom("");
    setTxTo("");
  }

  async function submitExpense(values: ExpenseValues) {
    setBusy(true);
    const result = editingExpense
      ? await updateExpenseAction({ id: editingExpense.id, ...values })
      : await addExpenseAction(values);
    setBusy(false);
    if (!result.ok) {
      setExpenseError(result.error ?? "Could not save expense");
      return;
    }
    const updated = Boolean(editingExpense);
    setExpenseOpen(false);
    setEditingExpense(null);
    setExpenseError("");
    if (result.entry) {
      setConfirmation({
        title: updated ? "Expense updated" : "Expense recorded",
        message: updated
          ? "The correction is saved and the account history keeps both the old and new movement."
          : "The expense has been deducted from the selected account.",
        facts: financeFacts(result.entry, "expense"),
      });
    } else {
      toast(updated ? "Expense updated" : "Expense saved");
    }
    router.refresh();
  }

  async function reverseEntry() {
    if (!reverseTarget) return;
    setReverseBusy(true);
    const result = await reverseFinanceEntryAction(reverseTarget.id);
    setReverseBusy(false);
    if (!result.ok || !result.reversal) {
      setReverseError(result.error ?? "Could not reverse this transaction");
      return;
    }
    const reversal = result.reversal;
    setReverseTarget(null);
    setReverseError("");
    setConfirmation({
      title: reversal.type === "expense" ? "Expense reversed" : "Income reversed",
      message:
        "The entry was removed from your reports and a matching reversal was added to the account history. Both movements can be seen under Business accounts.",
      facts: [
        { label: "Category", value: reversal.category },
        {
          label: reversal.type === "expense" ? "Amount returned" : "Amount removed",
          value: <MoneyText amount={reversal.amount} className="inline-money" fit={false} />,
          tone: reversal.type === "expense" ? "pos" : "neg",
        },
        {
          label: "Account",
          value: reversal.account_name ?? "Cash (default account)",
        },
        ...(reversal.account_balance_after !== null
          ? [
              {
                label: "Updated account balance",
                value: (
                  <MoneyText
                    amount={reversal.account_balance_after}
                    className="inline-money"
                    fit={false}
                  />
                ),
              },
            ]
          : []),
      ],
    });
    router.refresh();
  }

  return (
    <>
      <nav className="money-nav" aria-label="Money sections">
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

      {tab === "overview" ? (
        <>
          <section className="surface money-hero" aria-label="Available Business Funds">
            <div className="money-hero-head">
              <span className="icon-circle solid sm">
                <Icon name="wallet" size={19} />
              </span>
              <div className="grow">
                <b className="surface-title">Available Business Funds</b>
                <small className="surface-sub">Money you can use right now</small>
              </div>
            </div>
            <MoneyText className="money-hero-total" amount={overview.available_funds} />
            <p className="money-hero-note">
              Only money actually received is counted here. Unpaid sales and supplier bills are
              shown separately below.
            </p>
            <div className="money-quick-actions">
              <button type="button" className="btn sm" onClick={() => openExpense()}>
                <Icon name="plus" size={14} /> Expense
              </button>
              <button type="button" className="btn sm ghost" onClick={() => setIncomeOpen(true)}>
                <Icon name="plus" size={14} /> Income
              </button>
              <button type="button" className="btn sm ghost" onClick={() => openBudget()}>
                Set budget
              </button>
            </div>
          </section>

          <div className="money-stat-grid">
            <MoneyStat
              label="Received this month"
              amount={overview.received_this_month}
              note={`Sales ${Math.round(overview.sales_received_this_month).toLocaleString("en-US")} · Other ${Math.round(overview.other_income_this_month).toLocaleString("en-US")}`}
              tone="good"
              icon="plusc"
            />
            <MoneyStat
              label="Spent this month"
              amount={overview.expenses_this_month}
              tone="plain"
              icon="cart"
            />
            <MoneyStat
              label="Profit this month"
              amount={overview.profit_this_month}
              note="Received minus expenses"
              tone={overview.profit_this_month >= 0 ? "good" : "bad"}
              icon="trend"
            />
            <MoneyStat
              label="Owed to you"
              amount={overview.receivables}
              note="Not yet received"
              tone={overview.receivables > 0 ? "warn" : "plain"}
              icon="receipt"
            />
            <MoneyStat
              label="You owe suppliers"
              amount={overview.payables}
              note="Not yet paid"
              tone={overview.payables > 0 ? "bad" : "plain"}
              icon="box"
            />
          </div>

          <section className="surface money-overview-links" aria-label="Money shortcuts">
            <div className="surface-head">
              <span className="icon-circle">
                <Icon name="coins" size={20} />
              </span>
              <div className="grow">
                <b className="surface-title">Where your money is</b>
                <small className="surface-sub">
                  {activeAccounts.length
                    ? `${activeAccounts.length} active account${activeAccounts.length === 1 ? "" : "s"}`
                    : "No business accounts yet"}
                </small>
              </div>
              <Link className="link" href="/accounts">
                Manage
              </Link>
            </div>
            {activeAccounts.length ? (
              <div className="money-account-list">
                {activeAccounts.map((account) => (
                  <div className="money-account-row" key={account.id}>
                    <span className="money-account-icon">
                      <Icon name={accountIcon(account.kind, account.icon)} size={16} />
                    </span>
                    <span className="grow">
                      <b>{account.name}</b>
                      <small>{accountKindLabel(account.kind)}</small>
                    </span>
                    <b className={account.balance < 0 ? "neg" : ""}>
                      <MoneyText amount={account.balance} className="inline-money" fit={false} />
                    </b>
                  </div>
                ))}
              </div>
            ) : (
              <Link className="btn sm ghost" href="/accounts">
                Add your first account
              </Link>
            )}
          </section>
        </>
      ) : null}

      {tab === "accounts" ? (
        <section className="surface" aria-label="Business accounts">
          <div className="surface-head">
            <span className="icon-circle">
              <Icon name="coins" size={20} />
            </span>
            <div className="grow">
              <b className="surface-title">Business accounts</b>
              <small className="surface-sub">Cash, bank, mobile money and savings</small>
            </div>
            <Link className="link" href="/accounts">
              Manage
            </Link>
          </div>

          <div className="money-account-total">
            <small>Total available</small>
            <MoneyText amount={overview.available_funds} />
          </div>

          {data.accounts.length ? (
            <div className="money-account-list">
              {data.accounts.map((account) => (
                <div
                  className={`money-account-row${account.is_active ? "" : " is-inactive"}`}
                  key={account.id}
                >
                  <span className="money-account-icon">
                    <Icon name={accountIcon(account.kind, account.icon)} size={16} />
                  </span>
                  <span className="grow">
                    <b>{account.name}</b>
                    <small>
                      {accountKindLabel(account.kind)}
                      {account.is_active ? "" : " · Inactive"}
                    </small>
                  </span>
                  <b className={account.balance < 0 ? "neg" : ""}>
                    <MoneyText amount={account.balance} className="inline-money" fit={false} />
                  </b>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <b>No business accounts yet</b>
              <small>Add cash, bank or mobile money accounts to track where money is held.</small>
            </div>
          )}

          <Link className="btn" href="/accounts" style={{ marginTop: 12 }}>
            Open account management
          </Link>
          <small className="surface-foot">
            Add accounts, move money between them, and view full account history.
          </small>
        </section>
      ) : null}

      {tab === "exp" ? (
        <>
          <button className="btn" style={{ marginBottom: 12 }} onClick={() => openExpense()}>
            + Add expense
          </button>
          <div className="card">
            {data.expenses.length ? (
              data.expenses.map((expense) => {
                const monthly = (expense.frequency ?? "daily") === "monthly";
                const paidFrom = accountName(data.accounts, expense.account_id);
                return (
                  <div className="row" key={expense.id}>
                    <div className="grow">
                      <b>
                        {expense.category}{" "}
                        {monthly ? <span className="tag amb">Monthly</span> : null}
                      </b>
                      <small style={{ display: "block" }}>
                        {formatDay(expense.entry_date)}
                        {paidFrom ? ` · ${paidFrom}` : ""}
                        {expense.notes ? ` · ${expense.notes}` : ""}
                      </small>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <b className="neg">
                        −<MoneyText amount={expense.amount} className="inline-money" fit={false} />
                      </b>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="link"
                          onClick={() => openExpense(expense)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="link danger"
                          onClick={() => {
                            setReverseError("");
                            setReverseTarget(expense);
                          }}
                        >
                          Reverse
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon="cart"
                title="No expenses recorded yet"
                description="Add an expense to see where your money is going and keep your account balance accurate."
                actionLabel="Add expense"
                onAction={() => openExpense()}
              />
            )}
          </div>
        </>
      ) : null}

      {tab === "inc" ? (
        <>
          <button className="btn" style={{ marginBottom: 12 }} onClick={() => setIncomeOpen(true)}>
            + Add other income
          </button>
          <div className="card">
            <h3>Product sales are added automatically</h3>
            <p className="money-card-note">
              Use this for money that did not come from selling products, like tailoring, repairs or
              commission.
            </p>
            {data.income.length ? (
              data.income.map((entry) => {
                const receivedInto = accountName(data.accounts, entry.account_id);
                return (
                  <div className="row" key={entry.id}>
                    <div className="grow">
                      <b>{entry.category}</b>
                      <small>
                        {formatDay(entry.entry_date)}
                        {receivedInto ? ` · ${receivedInto}` : ""}
                        {entry.notes ? ` · ${entry.notes}` : ""}
                      </small>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <b className="pos">
                        +<MoneyText amount={entry.amount} className="inline-money" fit={false} />
                      </b>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="link danger"
                          onClick={() => {
                            setReverseError("");
                            setReverseTarget(entry);
                          }}
                        >
                          Reverse
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon="plusc"
                title="No other income recorded yet"
                description="Record money from tailoring, repairs, delivery or commission that did not come from product sales."
                actionLabel="Add other income"
                onAction={() => setIncomeOpen(true)}
              />
            )}
          </div>
        </>
      ) : null}

      {tab === "bud" ? (
        <>
          <section className="surface money-budget-summary" aria-label="Budget summary">
            <div className="surface-head">
              <span className="icon-circle">
                <Icon name="chart" size={20} />
              </span>
              <div className="grow">
                <b className="surface-title">This month&apos;s budgets</b>
                <small className="surface-sub">
                  {data.budgets.length
                    ? `${data.budgets.length} budget${data.budgets.length === 1 ? "" : "s"} set`
                    : "Keep spending under control"}
                </small>
              </div>
              <button type="button" className="btn sm ghost" onClick={() => openBudget()}>
                Set budget
              </button>
            </div>
            <div className="money-budget-totals">
              <div>
                <small>Budgeted</small>
                <b>
                  <MoneyText amount={totalBudgetProgress.limit} className="inline-money" fit={false} />
                </b>
              </div>
              <div>
                <small>Spent</small>
                <b>
                  <MoneyText amount={totalBudgetProgress.spent} className="inline-money" fit={false} />
                </b>
              </div>
              <div>
                <small>{totalBudgetProgress.remaining >= 0 ? "Left" : "Over"}</small>
                <b className={totalBudgetProgress.remaining < 0 ? "neg" : ""}>
                  <MoneyText
                    amount={Math.abs(totalBudgetProgress.remaining)}
                    className="inline-money"
                    fit={false}
                  />
                </b>
              </div>
            </div>
            <div className="bar">
              <i
                className={
                  totalBudgetProgress.status === "over"
                    ? "over"
                    : totalBudgetProgress.status === "close"
                      ? "warn"
                      : ""
                }
                style={{ width: `${Math.min(100, totalBudgetProgress.percent)}%` }}
              />
            </div>
          </section>

          <div className="card">
            {data.budgets.length ? (
              data.budgets.map((budget) => {
                const progress = budgetProgress(
                  budget.monthly_limit,
                  data.spentByCategory[budget.category] || 0,
                );
                return (
                  <div className="money-budget-row" key={budget.id}>
                    <div className="money-budget-head">
                      <b>{budget.category}</b>
                      <span
                        className={`tag ${
                          progress.status === "over"
                            ? "red"
                            : progress.status === "close"
                              ? "amb"
                              : ""
                        }`}
                      >
                        {progress.status === "over"
                          ? "Over budget"
                          : progress.status === "close"
                            ? "Close to limit"
                            : `${Math.round(progress.percent)}% used`}
                      </span>
                      <button
                        type="button"
                        className="link"
                        style={{ fontSize: 11.5 }}
                        onClick={() => openBudget(budget)}
                      >
                        Edit
                      </button>
                    </div>
                    <div className="bar">
                      <i
                        className={
                          progress.status === "over" ? "over" : progress.status === "close" ? "warn" : ""
                        }
                        style={{ width: `${Math.min(100, progress.percent)}%` }}
                      />
                    </div>
                    <div className="money-budget-meta">
                      <span>
                        Budgeted <b><MoneyText amount={progress.limit} className="inline-money" fit={false} /></b>
                      </span>
                      <span>
                        Spent <b><MoneyText amount={progress.spent} className="inline-money" fit={false} /></b>
                      </span>
                      <span>
                        {progress.remaining >= 0 ? "Remaining" : "Over by"}{" "}
                        <b className={progress.remaining < 0 ? "neg" : ""}>
                          <MoneyText
                            amount={Math.abs(progress.remaining)}
                            className="inline-money"
                            fit={false}
                          />
                        </b>
                      </span>
                      <span>{Math.round(progress.percent)}% used</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon="chart"
                title="No budgets set yet"
                description="Set a monthly limit for a category and see how much is left as you spend."
                actionLabel="Set your first budget"
                onAction={() => openBudget()}
              />
            )}
          </div>
        </>
      ) : null}

      {tab === "tx" ? (
        <>
          <section className="surface money-filters" aria-label="Transaction filters">
            <div className="money-search">
              <Icon name="receipt" size={16} />
              <input
                type="search"
                value={txSearch}
                placeholder="Search description, account or category"
                aria-label="Search transactions"
                onChange={(event) => setTxSearch(event.target.value)}
              />
            </div>
            <div className="money-filter-grid">
              <div>
                <label htmlFor="tx-kind">Type</label>
                <select id="tx-kind" value={txKind} onChange={(event) => setTxKind(event.target.value)}>
                  {TRANSACTION_KINDS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tx-account">Account</label>
                <select
                  id="tx-account"
                  value={txAccount}
                  onChange={(event) => setTxAccount(event.target.value)}
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
                <label htmlFor="tx-category">Category</label>
                <select
                  id="tx-category"
                  value={txCategory}
                  onChange={(event) => setTxCategory(event.target.value)}
                >
                  <option value="all">All categories</option>
                  {transactionCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tx-from">From</label>
                <input
                  id="tx-from"
                  type="date"
                  max={txTo || todayKey()}
                  value={txFrom}
                  onChange={(event) => setTxFrom(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="tx-to">To</label>
                <input
                  id="tx-to"
                  type="date"
                  min={txFrom || undefined}
                  max={todayKey()}
                  value={txTo}
                  onChange={(event) => setTxTo(event.target.value)}
                />
              </div>
            </div>
            <div className="money-filter-foot">
              <small>
                {filteredTransactions.length} transaction
                {filteredTransactions.length === 1 ? "" : "s"}
              </small>
              {hasTxFilters ? (
                <button type="button" className="link" onClick={clearTxFilters}>
                  Clear filters
                </button>
              ) : null}
            </div>
          </section>

          <div className="card">
            {filteredTransactions.length ? (
              <div className="account-movements">
                {filteredTransactions.map((transaction) => {
                  const positive = transaction.amount >= 0;
                  return (
                    <div className="account-movement" key={transaction.id}>
                      <span className={`account-movement-icon ${positive ? "in" : "out"}`}>
                        <Icon name={TRANSACTION_ICONS[transaction.kind]} size={16} />
                      </span>
                      <div className="grow">
                        <b>{transaction.title}</b>
                        <small>
                          {formatDay(transaction.date)}
                          {transaction.account_name ? ` · ${transaction.account_name}` : ""}
                          {` · ${transaction.category}`}
                        </small>
                        {transaction.outstanding ? (
                          <span className="money-outstanding-tag">
                            <MoneyText
                              amount={transaction.outstanding}
                              className="inline-money"
                              fit={false}
                            />{" "}
                            unpaid
                          </span>
                        ) : null}
                      </div>
                      <b className={`account-amount ${positive ? "pos" : "neg"}`}>
                        {positive ? "+" : "−"}
                        <MoneyText
                          amount={Math.abs(transaction.amount)}
                          className="inline-money"
                          fit={false}
                        />
                      </b>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <b>No transactions match these filters</b>
                <small>Try a different search, account or date range.</small>
                {hasTxFilters ? (
                  <button type="button" className="btn sm ghost" onClick={clearTxFilters}>
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </>
      ) : null}

      <ExpenseSheet
        key={editingExpense?.id ?? (expenseOpen ? "new" : "closed")}
        open={expenseOpen}
        entry={editingExpense}
        categories={data.categories.expense}
        accounts={data.accounts}
        busy={busy}
        error={expenseError}
        onClose={() => setExpenseOpen(false)}
        onSubmit={submitExpense}
      />

      <IncomeSheet
        key={incomeOpen ? "income-open" : "income-closed"}
        open={incomeOpen}
        categories={data.categories.income}
        accounts={data.accounts}
        busy={busy}
        error={incomeError}
        onClose={() => setIncomeOpen(false)}
        onSubmit={async (values) => {
          setBusy(true);
          const result = await addIncomeAction(values);
          setBusy(false);
          if (!result.ok) {
            setIncomeError(result.error ?? "Could not save income");
            return;
          }
          setIncomeOpen(false);
          setIncomeError("");
          if (result.entry) {
            setConfirmation({
              title: "Income recorded",
              message: "The money has been added to the selected receiving account.",
              facts: financeFacts(result.entry, "income"),
            });
          } else {
            toast("Income saved");
          }
          router.refresh();
        }}
      />

      <BudgetSheet
        key={editingBudget?.id ?? (budgetOpen ? "budget-new" : "budget-closed")}
        open={budgetOpen}
        entry={editingBudget}
        categories={data.categories.expense}
        busy={busy}
        error={budgetError}
        onClose={() => setBudgetOpen(false)}
        onSubmit={async (category, limit) => {
          setBusy(true);
          const result = await setBudgetAction({ category, monthly_limit: limit });
          setBusy(false);
          if (!result.ok) {
            setBudgetError(result.error ?? "Could not save budget");
            return;
          }
          setBudgetOpen(false);
          setBudgetError("");
          toast("Budget saved");
          router.refresh();
        }}
      />

      <ConfirmSheet
        open={Boolean(reverseTarget)}
        onClose={() => {
          if (!reverseBusy) setReverseTarget(null);
        }}
        title={reverseTarget?.type === "income" ? "Reverse this income?" : "Reverse this expense?"}
        description={
          reverseTarget?.type === "income"
            ? "The money will be removed from the receiving account and this income will no longer count in your reports. The original and the reversal stay in the account history."
            : "The money will be returned to the payment account and this expense will no longer count in your reports. The original and the reversal stay in the account history."
        }
        confirmLabel={reverseTarget?.type === "income" ? "Reverse income" : "Reverse expense"}
        busy={reverseBusy}
        error={reverseError}
        onConfirm={reverseEntry}
      >
        {reverseTarget ? (
          <dl className="success-facts">
            <div>
              <dt>Category</dt>
              <dd>{reverseTarget.category}</dd>
            </div>
            <div>
              <dt>Amount</dt>
              <dd>
                <MoneyText
                  amount={reverseTarget.amount}
                  className="inline-money"
                  fit={false}
                />
              </dd>
            </div>
            <div>
              <dt>{reverseTarget.type === "income" ? "Received into" : "Paid from"}</dt>
              <dd>{accountName(data.accounts, reverseTarget.account_id) || "Cash (default account)"}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDay(reverseTarget.entry_date)}</dd>
            </div>
          </dl>
        ) : null}
      </ConfirmSheet>

      <SuccessSheet
        open={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        title={confirmation?.title ?? "Saved"}
        message={confirmation?.message}
        facts={confirmation?.facts ?? []}
        warning={confirmation?.warning}
      />
    </>
  );
}

function withCurrent(categories: string[], current?: string) {
  return current && !categories.includes(current) ? [current, ...categories] : categories;
}

function ExpenseSheet({
  open,
  entry,
  categories,
  accounts,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  entry: FinanceEntry | null;
  categories: string[];
  accounts: AccountSummary[];
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: ExpenseValues) => Promise<void>;
}) {
  const options = withCurrent(categories, entry?.category);
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [category, setCategory] = useState(entry?.category ?? "Other");
  const [accountId, setAccountId] = useState(
    entry?.account_id ?? preferredAccountId(accounts),
  );
  const [entryDate, setEntryDate] = useState(entry?.entry_date ?? todayKey());
  const [note, setNote] = useState(entry?.notes ?? "");
  const [frequency, setFrequency] = useState<ExpenseFrequency>(
    entry?.frequency === "monthly" ? "monthly" : "daily",
  );
  const [localError, setLocalError] = useState("");

  function submit() {
    const parsed = parseMoneyInput(amount);
    const cleanCategory = category.trim();
    const problem = validateMoneyEntry({
      amount: parsed,
      category: cleanCategory,
      entryDate,
      accountId: accountId || null,
      requireAccount: accounts.some((account) => account.is_active),
    });
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError("");
    onSubmit({
      category: cleanCategory,
      amount: parsed as number,
      note,
      frequency,
      entry_date: entryDate,
      account_id: accountId || null,
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={entry ? "Edit expense" : "Add expense"}
      subtitle="Record money going out of your business"
    >
      <label htmlFor="e-amount">Amount (UGX)</label>
      <input
        id="e-amount"
        type="text"
        inputMode="numeric"
        value={amount}
        placeholder="e.g. 50000"
        autoFocus
        onChange={(event) => {
          setAmount(event.target.value);
          setLocalError("");
        }}
      />

      <CategoryPicker
        id="e-cat"
        label="Category"
        value={category}
        options={options}
        placeholder="Search or type a new category"
        help="Start typing to search. You can also add your own category."
        onChange={(value) => {
          setCategory(value);
          setLocalError("");
        }}
      />

      <AccountPicker
        id="e-account"
        label="Paid from"
        accounts={accounts}
        value={accountId}
        onChange={(value) => {
          setAccountId(value);
          setLocalError("");
        }}
      />

      <label htmlFor="e-date">Date</label>
      <input
        id="e-date"
        type="date"
        max={todayKey()}
        value={entryDate}
        onChange={(event) => {
          setEntryDate(event.target.value);
          setLocalError("");
        }}
      />

      <label htmlFor="e-note">Description (optional)</label>
      <input
        id="e-note"
        value={note}
        placeholder="e.g. Boda to market"
        maxLength={200}
        onChange={(event) => setNote(event.target.value)}
      />

      <label>Does this repeat?</label>
      <div className="opts" role="group" aria-label="Expense frequency">
        {EXPENSE_FREQUENCIES.map((option) => (
          <button
            type="button"
            key={option}
            className={`opt ${frequency === option ? "on" : ""}`}
            aria-pressed={frequency === option}
            onClick={() => setFrequency(option)}
          >
            {option === "daily" ? "One-off" : "Monthly"}
          </button>
        ))}
      </div>

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
        ) : entry ? (
          "Save changes"
        ) : (
          "Save expense"
        )}
      </button>
    </BottomSheet>
  );
}

function IncomeSheet({
  open,
  categories,
  accounts,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  categories: string[];
  accounts: AccountSummary[];
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: {
    category: string;
    amount: number;
    note: string;
    entry_date: string;
    account_id: string | null;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Other");
  const [accountId, setAccountId] = useState(preferredAccountId(accounts));
  const [entryDate, setEntryDate] = useState(todayKey());
  const [note, setNote] = useState("");
  const [localError, setLocalError] = useState("");

  function submit() {
    const parsed = parseMoneyInput(amount);
    const cleanCategory = category.trim();
    const problem = validateMoneyEntry({
      amount: parsed,
      category: cleanCategory,
      entryDate,
      accountId: accountId || null,
      requireAccount: accounts.some((account) => account.is_active),
    });
    if (problem) {
      setLocalError(
        cleanCategory ? problem : "Enter where this money came from",
      );
      return;
    }
    setLocalError("");
    onSubmit({
      category: cleanCategory,
      amount: parsed as number,
      note,
      entry_date: entryDate,
      account_id: accountId || null,
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Add other income"
      subtitle="Money that did not come from product sales"
    >
      <label htmlFor="i-amount">Amount (UGX)</label>
      <input
        id="i-amount"
        type="text"
        inputMode="numeric"
        value={amount}
        placeholder="e.g. 50000"
        autoFocus
        onChange={(event) => {
          setAmount(event.target.value);
          setLocalError("");
        }}
      />

      <CategoryPicker
        id="i-source"
        label="Source"
        value={category}
        options={withCurrent(categories)}
        placeholder="Search or type a new source"
        help="For example tailoring, repairs, delivery or commission."
        onChange={(value) => {
          setCategory(value);
          setLocalError("");
        }}
      />

      <AccountPicker
        id="i-account"
        label="Received into"
        accounts={accounts}
        value={accountId}
        onChange={(value) => {
          setAccountId(value);
          setLocalError("");
        }}
      />

      <label htmlFor="i-date">Date</label>
      <input
        id="i-date"
        type="date"
        max={todayKey()}
        value={entryDate}
        onChange={(event) => {
          setEntryDate(event.target.value);
          setLocalError("");
        }}
      />

      <label htmlFor="i-note">Description (optional)</label>
      <input
        id="i-note"
        value={note}
        placeholder="e.g. Repairs for a customer"
        maxLength={200}
        onChange={(event) => setNote(event.target.value)}
      />

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
        ) : (
          "Save income"
        )}
      </button>
    </BottomSheet>
  );
}

function BudgetSheet({
  open,
  entry,
  categories,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  entry: Budget | null;
  categories: string[];
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (category: string, limit: number) => Promise<void>;
}) {
  const options = withCurrent(categories, entry?.category);
  const [category, setCategory] = useState(entry?.category ?? "Other");
  const [limit, setLimit] = useState(entry ? String(entry.monthly_limit) : "");
  const [localError, setLocalError] = useState("");

  function submit() {
    const parsed = parseMoneyInput(limit);
    const cleanCategory = category.trim();
    if (!cleanCategory) {
      setLocalError("Choose or type an expense category");
      return;
    }
    if (!Number.isFinite(parsed) || (parsed ?? 0) <= 0) {
      setLocalError("Enter a budget greater than 0");
      return;
    }
    setLocalError("");
    onSubmit(cleanCategory, parsed as number);
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Set monthly budget"
      subtitle="Choose how much you plan to spend in a category"
    >
      <CategoryPicker
        id="b-cat"
        label="Expense category"
        value={category}
        options={options}
        placeholder="Search or type a category"
        onChange={(value) => {
          setCategory(value);
          setLocalError("");
        }}
      />
      <label htmlFor="b-limit">Budget amount (UGX)</label>
      <input
        id="b-limit"
        type="text"
        inputMode="numeric"
        value={limit}
        placeholder="e.g. 200000"
        autoFocus
        onChange={(event) => {
          setLimit(event.target.value);
          setLocalError("");
        }}
      />
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
        ) : (
          "Save budget"
        )}
      </button>
    </BottomSheet>
  );
}
