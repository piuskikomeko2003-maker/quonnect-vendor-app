"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addExpenseAction,
  addIncomeAction,
  setBudgetAction,
  updateExpenseAction,
} from "@/actions/business";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { EXPENSE_FREQUENCIES, type ExpenseFrequency } from "@/lib/constants";
import { formatDay, formatUGX, todayKey } from "@/lib/format";
import type { MoneyData } from "@/lib/types";
import type { Budget, FinanceEntry } from "@/types/app-db";

type MoneyTab = "exp" | "inc" | "bud";

interface ExpenseValues {
  category: string;
  amount: number;
  note: string;
  frequency: ExpenseFrequency;
  entry_date: string;
}

interface CategoryFieldProps {
  id: string;
  label: string;
  categories: string[];
  value: string;
  adding: boolean;
  custom: string;
  onValue: (value: string) => void;
  onAdding: (adding: boolean) => void;
  onCustom: (value: string) => void;
}

function CategoryField({
  id,
  label,
  categories,
  value,
  adding,
  custom,
  onValue,
  onAdding,
  onCustom,
}: CategoryFieldProps) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} disabled={adding} onChange={(event) => onValue(event.target.value)}>
        {categories.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      {adding ? (
        <input
          value={custom}
          onChange={(event) => onCustom(event.target.value)}
          placeholder="Name your category"
        />
      ) : null}
      <button
        type="button"
        className="link"
        style={{ fontSize: 12, marginTop: 6, alignSelf: "flex-start" }}
        onClick={() => onAdding(!adding)}
      >
        {adding ? "Choose an existing category" : "+ Add new category"}
      </button>
    </>
  );
}

export function MoneyScreen({ data, initialTab = "exp" }: { data: MoneyData; initialTab?: MoneyTab }) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<MoneyTab>(initialTab);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FinanceEntry | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [busy, setBusy] = useState(false);

  function openExpense(entry: FinanceEntry | null = null) {
    setEditingExpense(entry);
    setExpenseOpen(true);
  }

  function openBudget(budget: Budget | null = null) {
    setEditingBudget(budget);
    setBudgetOpen(true);
  }

  async function submitExpense(values: ExpenseValues) {
    setBusy(true);
    const result = editingExpense
      ? await updateExpenseAction({ id: editingExpense.id, ...values })
      : await addExpenseAction(values);
    setBusy(false);
    if (!result.ok) return toast(result.error ?? "Could not save expense");
    setExpenseOpen(false);
    toast(editingExpense ? "Expense updated" : "Expense saved");
    router.refresh();
  }

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
          <button className="btn" style={{ marginBottom: 12 }} onClick={() => openExpense()}>
            + Add expense
          </button>
          <div className="card">
            {data.expenses.length ? (
              data.expenses.map((expense) => {
                const monthly = (expense.frequency ?? "daily") === "monthly";
                return (
                  <div className="row" key={expense.id}>
                    <div className="grow">
                      <b>
                        {expense.category}{" "}
                        <span className={`tag ${monthly ? "amb" : ""}`}>{monthly ? "Monthly" : "Daily"}</span>
                      </b>
                      <small style={{ display: "block" }}>
                        {formatDay(expense.entry_date)}
                        {expense.notes ? ` · ${expense.notes}` : ""}
                      </small>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <b className="neg">−{formatUGX(expense.amount)}</b>
                      <button
                        type="button"
                        className="link"
                        style={{ display: "block", marginLeft: "auto", fontSize: 11.5 }}
                        onClick={() => openExpense(expense)}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })
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
                    <small>
                      {formatDay(entry.entry_date)}
                      {entry.notes ? ` · ${entry.notes}` : ""}
                    </small>
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
            <button type="button" className="btn sm ghost" onClick={() => openBudget()}>
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
                      {formatUGX(spent)} / {formatUGX(limit)}{" "}
                      <button
                        type="button"
                        className="link"
                        style={{ fontSize: 11.5 }}
                        onClick={() => openBudget(budget)}
                      >
                        Edit
                      </button>
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
        key={editingExpense?.id ?? (expenseOpen ? "new" : "closed")}
        open={expenseOpen}
        entry={editingExpense}
        categories={data.categories.expense}
        busy={busy}
        onClose={() => setExpenseOpen(false)}
        onSubmit={submitExpense}
      />

      <IncomeSheet
        key={incomeOpen ? "income-open" : "income-closed"}
        open={incomeOpen}
        categories={data.categories.income}
        busy={busy}
        onClose={() => setIncomeOpen(false)}
        onSubmit={async (category, amount, note) => {
          setBusy(true);
          const result = await addIncomeAction({ category, amount, note });
          setBusy(false);
          if (!result.ok) return toast(result.error ?? "Could not save income");
          setIncomeOpen(false);
          toast("Income saved");
          router.refresh();
        }}
      />

      <BudgetSheet
        key={editingBudget?.id ?? (budgetOpen ? "budget-new" : "budget-closed")}
        open={budgetOpen}
        entry={editingBudget}
        categories={data.categories.expense}
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

function withCurrent(categories: string[], current?: string) {
  return current && !categories.includes(current) ? [current, ...categories] : categories;
}

function ExpenseSheet({
  open,
  entry,
  categories,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  entry: FinanceEntry | null;
  categories: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: ExpenseValues) => Promise<void>;
}) {
  const options = withCurrent(categories, entry?.category);
  const [category, setCategory] = useState(entry?.category ?? options[0] ?? "Other");
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [note, setNote] = useState(entry?.notes ?? "");
  const [frequency, setFrequency] = useState<ExpenseFrequency>(
    entry?.frequency === "monthly" ? "monthly" : "daily",
  );
  const [entryDate, setEntryDate] = useState(entry?.entry_date ?? todayKey());
  const chosen = adding ? custom.trim() : category;

  return (
    <BottomSheet open={open} onClose={onClose} title={entry ? "Edit expense" : "Add expense"}>
      <CategoryField
        id="e-cat"
        label="Category"
        categories={options}
        value={category}
        adding={adding}
        custom={custom}
        onValue={setCategory}
        onAdding={setAdding}
        onCustom={setCustom}
      />
      <label htmlFor="e-amount">Amount (UGX)</label>
      <input
        id="e-amount"
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <label>Is this a daily or monthly expense?</label>
      <div className="opts" role="group" aria-label="Expense frequency">
        {EXPENSE_FREQUENCIES.map((option) => (
          <button
            type="button"
            key={option}
            className={`opt ${frequency === option ? "on" : ""}`}
            aria-pressed={frequency === option}
            onClick={() => setFrequency(option)}
          >
            {option === "daily" ? "Daily" : "Monthly"}
          </button>
        ))}
      </div>
      <label htmlFor="e-date">Date</label>
      <input
        id="e-date"
        type="date"
        max={todayKey()}
        value={entryDate}
        onChange={(event) => setEntryDate(event.target.value)}
      />
      <label htmlFor="e-note">Note (optional)</label>
      <input id="e-note" value={note} onChange={(event) => setNote(event.target.value)} />
      <button
        className="btn"
        style={{ marginTop: 14 }}
        disabled={busy || !chosen}
        onClick={() =>
          onSubmit({
            category: chosen,
            amount: Number(amount),
            note,
            frequency,
            entry_date: entryDate,
          })
        }
      >
        {busy ? "Saving…" : entry ? "Save changes" : "Save expense"}
      </button>
    </BottomSheet>
  );
}

function IncomeSheet({
  open,
  categories,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  categories: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (category: string, amount: number, note: string) => Promise<void>;
}) {
  const [category, setCategory] = useState(categories[0] ?? "Other");
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const chosen = adding ? custom.trim() : category;

  return (
    <BottomSheet open={open} onClose={onClose} title="Add other income">
      <CategoryField
        id="i-cat"
        label="Category"
        categories={categories}
        value={category}
        adding={adding}
        custom={custom}
        onValue={setCategory}
        onAdding={setAdding}
        onCustom={setCustom}
      />
      <label htmlFor="i-amount">Amount (UGX)</label>
      <input
        id="i-amount"
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <label htmlFor="i-note">Note (optional)</label>
      <input id="i-note" value={note} onChange={(event) => setNote(event.target.value)} />
      <button
        className="btn"
        style={{ marginTop: 14 }}
        disabled={busy || !chosen}
        onClick={() => onSubmit(chosen, Number(amount), note)}
      >
        {busy ? "Saving…" : "Save income"}
      </button>
    </BottomSheet>
  );
}

function BudgetSheet({
  open,
  entry,
  categories,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  entry: Budget | null;
  categories: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (category: string, limit: number) => Promise<void>;
}) {
  const options = withCurrent(categories, entry?.category);
  const [category, setCategory] = useState(entry?.category ?? options[0] ?? "Other");
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState("");
  const [limit, setLimit] = useState(entry ? String(entry.monthly_limit) : "");
  const chosen = adding ? custom.trim() : category;

  return (
    <BottomSheet open={open} onClose={onClose} title="Set monthly budget">
      <CategoryField
        id="b-cat"
        label="Expense category"
        categories={options}
        value={category}
        adding={adding}
        custom={custom}
        onValue={setCategory}
        onAdding={setAdding}
        onCustom={setCustom}
      />
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
        disabled={busy || !chosen}
        onClick={() => onSubmit(chosen, Number(limit))}
      >
        {busy ? "Saving…" : "Save budget"}
      </button>
    </BottomSheet>
  );
}
