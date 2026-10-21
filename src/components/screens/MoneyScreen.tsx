"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addExpenseAction, addIncomeAction, setBudgetAction } from "@/actions/business";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { formatUGX } from "@/lib/format";
import type { MoneyData } from "@/lib/types";

type MoneyTab = "exp" | "inc" | "bud";

export function MoneyScreen({ data, initialTab = "exp" }: { data: MoneyData; initialTab?: MoneyTab }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<MoneyTab>(initialTab);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <div className="seg" role="tablist" aria-label="Money sections">
        {(
          [
            ["exp", "Expenses"],
            ["inc", "Income"],
            ["bud", "Budgets"],
          ] as [MoneyTab, string][]
        ).map(([key, label]) => (
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

      {tab === "exp" ? (
        <>
          <button className="btn" style={{ marginBottom: 12 }} onClick={() => setExpenseOpen(true)}>
            + Add expense
          </button>
          <div className="card">
            {data.expenses.length ? (
              data.expenses.map((expense) => (
                <div className="row" key={expense.id}>
                  <div className="grow">
                    <b>{expense.category}</b>
                    <small>
                      {expense.entry_date}
                      {expense.notes ? ` · ${expense.notes}` : ""}
                    </small>
                  </div>
                  <b className="neg">−{formatUGX(expense.amount)}</b>
                </div>
              ))
            ) : (
              <div className="empty">No expenses yet</div>
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
            <h3>Sales are added automatically</h3>
            {data.income.length ? (
              data.income.map((entry) => (
                <div className="row" key={entry.id}>
                  <div className="grow">
                    <b>{entry.category}</b>
                    <small>{entry.entry_date}</small>
                  </div>
                  <b className="pos">+{formatUGX(entry.amount)}</b>
                </div>
              ))
            ) : (
              <div className="empty">No other income yet</div>
            )}
          </div>
        </>
      ) : null}

      {tab === "bud" ? (
        <div className="card">
          <h3>
            Monthly budgets{" "}
            <button type="button" className="btn sm ghost" onClick={() => setBudgetOpen(true)}>
              Set budget
            </button>
          </h3>
          {data.budgets.length ? (
            data.budgets.map((budget) => {
              const spent = data.spentByCategory[budget.category] || 0;
              const limit = Number(budget.monthly_limit);
              const percent = limit ? (spent / limit) * 100 : 0;
              return (
                <div style={{ marginBottom: 14 }} key={budget.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, gap: 8 }}>
                    <b>{budget.category}</b>
                    <span>
                      {formatUGX(spent)} / {formatUGX(limit)}
                    </span>
                  </div>
                  <div className="bar">
                    <i
                      className={percent >= 100 ? "over" : percent > 80 ? "warn" : ""}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                  {percent >= 100 ? (
                    <small className="neg">Over budget</small>
                  ) : percent > 80 ? (
                    <small style={{ color: "var(--amber)" }}>Almost at limit</small>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="empty">No budgets set</div>
          )}
        </div>
      ) : null}

      <ExpenseSheet
        open={expenseOpen}
        busy={busy}
        onClose={() => setExpenseOpen(false)}
        onSubmit={async (category, amount, note) => {
          setBusy(true);
          const result = await addExpenseAction({ category, amount, note });
          setBusy(false);
          if (!result.ok) return toast(result.error ?? "Could not save expense");
          setExpenseOpen(false);
          toast("Expense saved");
          router.refresh();
        }}
      />

      <IncomeSheet
        open={incomeOpen}
        busy={busy}
        onClose={() => setIncomeOpen(false)}
        onSubmit={async (source, amount) => {
          setBusy(true);
          const result = await addIncomeAction({ source, amount });
          setBusy(false);
          if (!result.ok) return toast(result.error ?? "Could not save income");
          setIncomeOpen(false);
          toast("Income saved");
          router.refresh();
        }}
      />

      <BudgetSheet
        open={budgetOpen}
        busy={busy}
        onClose={() => setBudgetOpen(false)}
        onSubmit={async (category, limit) => {
          setBusy(true);
          const result = await setBudgetAction({ category, monthly_limit: limit });
          setBusy(false);
          if (!result.ok) return toast(result.error ?? "Could not save budget");
          setBudgetOpen(false);
          toast("Budget saved");
          router.refresh();
        }}
      />
    </>
  );
}

function ExpenseSheet({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (category: string, amount: number, note: string) => Promise<void>;
}) {
  const [category, setCategory] = useState("Transport");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  return (
    <BottomSheet open={open} onClose={onClose} title="Add expense">
      <label htmlFor="e-cat">Category</label>
      <select id="e-cat" value={category} onChange={(event) => setCategory(event.target.value)}>
        {EXPENSE_CATEGORIES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <label htmlFor="e-amount">Amount (UGX)</label>
      <input
        id="e-amount"
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <label htmlFor="e-note">Note (optional)</label>
      <input id="e-note" value={note} onChange={(event) => setNote(event.target.value)} />
      <button
        className="btn"
        style={{ marginTop: 14 }}
        disabled={busy}
        onClick={() => onSubmit(category, Number(amount), note)}
      >
        {busy ? "Saving…" : "Save expense"}
      </button>
    </BottomSheet>
  );
}

function IncomeSheet({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (source: string, amount: number) => Promise<void>;
}) {
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <BottomSheet open={open} onClose={onClose} title="Add other income">
      <label htmlFor="i-source">Source</label>
      <input
        id="i-source"
        value={source}
        onChange={(event) => setSource(event.target.value)}
        placeholder="e.g. Tailoring job"
      />
      <label htmlFor="i-amount">Amount (UGX)</label>
      <input
        id="i-amount"
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <button
        className="btn"
        style={{ marginTop: 14 }}
        disabled={busy}
        onClick={() => onSubmit(source, Number(amount))}
      >
        {busy ? "Saving…" : "Save income"}
      </button>
    </BottomSheet>
  );
}

function BudgetSheet({
  open,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (category: string, limit: number) => Promise<void>;
}) {
  const [category, setCategory] = useState("Transport");
  const [limit, setLimit] = useState("");

  return (
    <BottomSheet open={open} onClose={onClose} title="Set monthly budget">
      <label htmlFor="b-cat">Category</label>
      <select id="b-cat" value={category} onChange={(event) => setCategory(event.target.value)}>
        {EXPENSE_CATEGORIES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <label htmlFor="b-limit">Limit (UGX)</label>
      <input
        id="b-limit"
        type="number"
        inputMode="numeric"
        value={limit}
        onChange={(event) => setLimit(event.target.value)}
      />
      <button
        className="btn"
        style={{ marginTop: 14 }}
        disabled={busy}
        onClick={() => onSubmit(category, Number(limit))}
      >
        {busy ? "Saving…" : "Save budget"}
      </button>
    </BottomSheet>
  );
}
