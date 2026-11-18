"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  createFinancialAccountAction,
  setFinancialAccountActiveAction,
  transferFundsAction,
  updateFinancialAccountAction,
} from "@/actions/accounts";
import { Icon } from "@/components/ui/Icon";
import { MoneyText } from "@/components/ui/MoneyText";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { SuccessSheet, type SuccessFact } from "@/components/ui/SuccessSheet";
import { useToast } from "@/components/ui/Toast";
import {
  ACCOUNT_COLORS,
  ACCOUNT_ICON_CHOICES,
  ACCOUNT_TYPES,
  accountColor,
  accountIcon,
  accountKindLabel,
  accountTypeValue,
  canDeactivateAccount,
  isAccountColor,
  isAccountIcon,
  movementLabel,
  totalAvailableFunds,
} from "@/lib/accounts";
import { formatDay } from "@/lib/format";
import { parseMoneyInput } from "@/lib/validation";
import type { AccountMovement, AccountSummary, AccountsData } from "@/lib/types";
import type { IconKey } from "@/lib/constants";

interface AccountFormValues {
  name: string;
  kind: string;
  opening_balance: number;
  description: string;
  color: string | null;
  icon: string | null;
}

function txDescription(movement: AccountMovement): string {
  const label = movementLabel(movement.kind);
  const note = movement.notes?.trim();
  return note && note !== label ? note : label;
}

function MovementRows({
  movements,
  showAccount = false,
}: {
  movements: AccountMovement[];
  showAccount?: boolean;
}) {
  if (!movements.length) {
    return (
      <EmptyState
        icon="receipt"
        title="No money movements yet"
        description="Sales, expenses, purchases and transfers will appear here as soon as money moves."
      />
    );
  }

  return (
    <div className="account-movements">
      {movements.map((movement) => {
        const positive = movement.amount >= 0;
        return (
          <div className="account-movement" key={movement.id}>
            <span className={`account-movement-icon ${positive ? "in" : "out"}`}>
              <Icon name={positive ? "plusc" : "swap"} size={16} />
            </span>
            <div className="grow">
              <b>{txDescription(movement)}</b>
              <small>
                {formatDay(movement.occurred_on)}
                {showAccount ? ` · ${movement.account_name}` : ""}
                {` · ${movementLabel(movement.kind)}`}
              </small>
            </div>
            <b className={`account-amount ${positive ? "pos" : "neg"}`}>
              {positive ? "+" : "−"}
              <MoneyText amount={Math.abs(movement.amount)} className="inline-money" fit={false} />
            </b>
          </div>
        );
      })}
    </div>
  );
}

function AccountCard({
  account,
  onView,
  onEdit,
  onTransfer,
  onToggle,
}: {
  account: AccountSummary;
  onView: () => void;
  onEdit: () => void;
  onTransfer: () => void;
  onToggle: () => void;
}) {
  const color = accountColor(account.kind, account.color);
  const canDeactivate = canDeactivateAccount(account.balance);

  return (
    <div
      className={`account-card${account.is_active ? "" : " is-inactive"}`}
      style={{ "--account-color": color } as CSSProperties}
    >
      <button type="button" className="account-card-main" onClick={onView}>
        <span className="account-avatar" aria-hidden="true">
          <Icon name={accountIcon(account.kind, account.icon)} size={20} />
        </span>
        <span className="grow account-card-copy">
          <b>{account.name}</b>
          <small>
            {accountKindLabel(account.kind)}
            {account.description ? ` · ${account.description}` : ""}
          </small>
          <small className="account-activity">
            {account.is_active
              ? account.movement_count
                ? `${account.movement_count} movement${account.movement_count === 1 ? "" : "s"}${
                    account.last_activity ? ` · last ${formatDay(account.last_activity)}` : ""
                  }`
                : "No money movements yet"
              : "Inactive · history kept"}
          </small>
        </span>
        <span className="account-balance">
          <MoneyText
            amount={account.balance}
            className={account.balance < 0 ? "neg" : ""}
            fit={false}
          />
          <small>{account.is_active ? "Current balance" : "Inactive balance"}</small>
        </span>
      </button>

      <div className="account-card-actions">
        <button type="button" className="link" onClick={onView}>
          View details
        </button>
        {account.is_active ? (
          <>
            <button type="button" className="link" onClick={onEdit}>
              Edit
            </button>
            <button type="button" className="link" onClick={onTransfer}>
              Transfer
            </button>
            {canDeactivate ? (
              <button type="button" className="link danger" onClick={onToggle}>
                Deactivate
              </button>
            ) : (
              <button type="button" className="link" onClick={onTransfer}>
                Move money first
              </button>
            )}
          </>
        ) : (
          <button type="button" className="link" onClick={onToggle}>
            Reactivate
          </button>
        )}
      </div>
    </div>
  );
}

export function AccountsScreen({ data }: { data: AccountsData }) {
  const router = useRouter();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccountSummary | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [transferFromId, setTransferFromId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<AccountSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [transferError, setTransferError] = useState("");
  const [toggleError, setToggleError] = useState("");
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    facts: SuccessFact[];
  } | null>(null);

  const activeAccounts = useMemo(
    () => data.accounts.filter((account) => account.is_active),
    [data.accounts],
  );
  const inactiveAccounts = useMemo(
    () => data.accounts.filter((account) => !account.is_active),
    [data.accounts],
  );
  const available = totalAvailableFunds(data.accounts);
  const movingTotal = data.accounts.reduce((total, account) => total + Number(account.balance), 0);
  const detail = detailId ? data.accounts.find((account) => account.id === detailId) ?? null : null;
  const detailMovements = useMemo(
    () => (detail ? data.transactions.filter((movement) => movement.account_id === detail.id) : []),
    [data.transactions, detail],
  );
  const recentMovements = data.transactions.slice(0, 12);

  function openCreate() {
    setEditing(null);
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(account: AccountSummary) {
    setEditing(account);
    setFormError("");
    setFormOpen(true);
  }

  function openTransfer(fromId?: string) {
    const fallback = fromId ?? activeAccounts[0]?.id ?? null;
    setTransferFromId(fallback);
    setTransferError("");
    setTransferOpen(true);
  }

  async function submitForm(values: AccountFormValues) {
    setBusy(true);
    const result = editing
      ? await updateFinancialAccountAction({ id: editing.id, ...values })
      : await createFinancialAccountAction(values);
    setBusy(false);

    if (!result.ok) {
      setFormError(result.error ?? "Could not save this account");
      return;
    }

    setFormOpen(false);
    setFormError("");
    toast(editing ? "Account updated" : "Account created");
    router.refresh();
  }

  async function submitTransfer(values: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    notes: string;
  }) {
    const fromAccount = data.accounts.find((account) => account.id === values.from_account_id);
    const toAccount = data.accounts.find((account) => account.id === values.to_account_id);
    setBusy(true);
    const result = await transferFundsAction(values);
    setBusy(false);

    if (!result.ok) {
      setTransferError(result.error ?? "Could not transfer money");
      return;
    }

    setTransferOpen(false);
    setTransferError("");
    setConfirmation({
      title: "Money transferred",
      message: "Both account balances were updated and the transfer is in your history.",
      facts: [
        {
          label: "Amount moved",
          value: <MoneyText amount={values.amount} className="inline-money" fit={false} />,
        },
        { label: "From", value: fromAccount?.name ?? "Selected account" },
        { label: "To", value: toAccount?.name ?? "Selected account" },
        ...(fromAccount
          ? [
              {
                label: `${fromAccount.name} balance`,
                value: (
                  <MoneyText
                    amount={fromAccount.balance - values.amount}
                    className="inline-money"
                    fit={false}
                  />
                ),
              },
            ]
          : []),
        ...(toAccount
          ? [
              {
                label: `${toAccount.name} balance`,
                value: (
                  <MoneyText
                    amount={toAccount.balance + values.amount}
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

  async function toggleAccount() {
    if (!toggleTarget) return;
    setBusy(true);
    const result = await setFinancialAccountActiveAction(
      toggleTarget.id,
      !toggleTarget.is_active,
    );
    setBusy(false);

    if (!result.ok) {
      setToggleError(result.error ?? "Could not update this account");
      return;
    }

    toast(toggleTarget.is_active ? "Account deactivated" : "Account reactivated");
    setToggleTarget(null);
    setToggleError("");
    router.refresh();
  }

  return (
    <>
      <section className="surface accounts-hero" aria-label="Available Business Funds">
        <div className="accounts-hero-head">
          <span className="icon-circle solid sm">
            <Icon name="wallet" size={19} />
          </span>
          <div className="grow">
            <b className="surface-title">Total Available Business Funds</b>
            <small className="surface-sub">Active business accounts only · current</small>
          </div>
          <button type="button" className="btn sm" onClick={openCreate}>
            <Icon name="plus" size={15} /> Add Account
          </button>
        </div>
        <MoneyText className="accounts-total" amount={available} />
        <div className="accounts-hero-meta">
          <span>
            {activeAccounts.length} active account{activeAccounts.length === 1 ? "" : "s"}
          </span>
          {inactiveAccounts.length ? (
            <span>{inactiveAccounts.length} inactive</span>
          ) : null}
          {movingTotal !== available ? <span>Inactive balances excluded</span> : null}
        </div>
        <p className="accounts-hero-note">
          Each balance is its opening balance plus every money movement recorded against it.
          Balances are never typed in directly, so they always match the transaction history.
        </p>
      </section>

      <section className="surface" aria-label="Active business accounts">
        <div className="surface-head">
          <span className="icon-circle">
            <Icon name="coins" size={20} />
          </span>
          <div className="grow">
            <b className="surface-title">Business accounts</b>
            <small className="surface-sub">Where your business money is held</small>
          </div>
        </div>

        {activeAccounts.length ? (
          <div className="account-list">
            {activeAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onView={() => setDetailId(account.id)}
                onEdit={() => openEdit(account)}
                onTransfer={() => openTransfer(account.id)}
                onToggle={() => {
                  setToggleError("");
                  setToggleTarget(account);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <b>No business accounts yet</b>
            <small>Add your cash box, bank account or mobile money wallet to start tracking.</small>
            <button type="button" className="btn sm" onClick={openCreate}>
              Add your first account
            </button>
          </div>
        )}
      </section>

      {inactiveAccounts.length ? (
        <section className="surface" aria-label="Inactive business accounts">
          <div className="surface-head">
            <span className="icon-circle">
              <Icon name="lock" size={20} />
            </span>
            <div className="grow">
              <b className="surface-title">Inactive accounts</b>
              <small className="surface-sub">Hidden from available funds · history kept</small>
            </div>
          </div>
          <div className="account-list">
            {inactiveAccounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onView={() => setDetailId(account.id)}
                onEdit={() => openEdit(account)}
                onTransfer={() => openTransfer(account.id)}
                onToggle={() => {
                  setToggleError("");
                  setToggleTarget(account);
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface" aria-label="Recent account transactions">
        <div className="surface-head">
          <span className="icon-circle">
            <Icon name="receipt" size={20} />
          </span>
          <div className="grow">
            <b className="surface-title">Recent transactions</b>
            <small className="surface-sub">Across all business accounts</small>
          </div>
        </div>
        <MovementRows movements={recentMovements} showAccount />
      </section>

      <AccountFormSheet
        key={editing?.id ?? (formOpen ? "create" : "closed")}
        open={formOpen}
        account={editing}
        busy={busy}
        error={formError}
        onClose={() => setFormOpen(false)}
        onSubmit={submitForm}
      />

      <BottomSheet
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail?.name}
        subtitle={detail ? `${accountKindLabel(detail.kind)} · ${detail.is_active ? "Active" : "Inactive"}` : undefined}
      >
        {detail ? (
          <>
            <div className="account-detail-total">
              <small>Current balance</small>
              <MoneyText amount={detail.balance} className={detail.balance < 0 ? "neg" : ""} />
              <span>
                Opening balance{" "}
                <MoneyText amount={detail.opening_balance} className="inline-money" fit={false} />
                {" "}+{" "}
                {detail.movement_count} recorded movement{detail.movement_count === 1 ? "" : "s"}
              </span>
            </div>

            {detail.description ? (
              <p className="account-detail-description">{detail.description}</p>
            ) : null}

            <div className="account-detail-actions">
              {detail.is_active ? (
                <>
                  <button type="button" className="btn sm ghost" onClick={() => openEdit(detail)}>
                    Edit account
                  </button>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => openTransfer(detail.id)}
                  >
                    Transfer money
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => {
                  setDetailId(null);
                  setToggleError("");
                  setToggleTarget(detail);
                }}
              >
                {detail.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </div>

            <h3 className="account-history-title">Transaction history</h3>
            <MovementRows movements={detailMovements} />
            <small className="funds-sheet-note">
              This history is append-only. Corrections are recorded as new movements, so past
              balances stay explainable.
            </small>
          </>
        ) : null}
      </BottomSheet>

      <TransferSheet
        key={`transfer-${transferOpen ? transferFromId ?? "open" : "closed"}`}
        open={transferOpen}
        accounts={activeAccounts}
        fromId={transferFromId}
        busy={busy}
        error={transferError}
        onClose={() => setTransferOpen(false)}
        onSubmit={submitTransfer}
      />

      <BottomSheet
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        title={toggleTarget?.is_active ? "Deactivate account" : "Reactivate account"}
        subtitle={toggleTarget?.name}
      >
        {toggleTarget ? (
          <>
            {toggleTarget.is_active ? (
              canDeactivateAccount(toggleTarget.balance) ? (
                <p className="account-confirm-text">
                  This account will stop counting toward Available Business Funds. Its transaction
                  history is kept and you can reactivate it later.
                </p>
              ) : (
                <p className="account-confirm-text">
                  This account still holds{" "}
                  <MoneyText
                    amount={toggleTarget.balance}
                    className="inline-money"
                    fit={false}
                  />
                  . Transfer the balance to another account first so the money is never silently
                  discarded.
                </p>
              )
            ) : (
              <p className="account-confirm-text">
                This account will start counting toward Available Business Funds again. Its
                history is unchanged.
              </p>
            )}

            <div className="err" role="alert">
              {toggleError}
            </div>

            {toggleTarget.is_active && !canDeactivateAccount(toggleTarget.balance) ? (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const id = toggleTarget.id;
                  setToggleTarget(null);
                  openTransfer(id);
                }}
              >
                Transfer balance first
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={busy}
                aria-busy={busy ? "true" : undefined}
                onClick={toggleAccount}
              >
                {busy ? (
                  <>
                    <Spinner /> Saving…
                  </>
                ) : toggleTarget.is_active ? (
                  "Deactivate account"
                ) : (
                  "Reactivate account"
                )}
              </button>
            )}
          </>
        ) : null}
      </BottomSheet>

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

function AccountFormSheet({
  open,
  account,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  account: AccountSummary | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: AccountFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState(
    account ? accountTypeValue(account.kind) : ACCOUNT_TYPES[0].value,
  );
  const [opening, setOpening] = useState(
    account ? String(Math.round(Number(account.opening_balance))) : "",
  );
  const [description, setDescription] = useState(account?.description ?? "");
  const [color, setColor] = useState<string | null>(
    account?.color && isAccountColor(account.color) ? account.color : null,
  );
  const [icon, setIcon] = useState<string | null>(
    account?.icon && isAccountIcon(account.icon) ? account.icon : null,
  );
  const [localError, setLocalError] = useState("");

  function submit() {
    const cleanName = name.trim();
    const parsedOpening = opening.trim() === "" ? 0 : parseMoneyInput(opening);

    if (!cleanName) {
      setLocalError("Enter an account name");
      return;
    }
    if (parsedOpening === null || parsedOpening < 0) {
      setLocalError("Enter a valid opening balance");
      return;
    }

    setLocalError("");
    onSubmit({
      name: cleanName,
      kind,
      opening_balance: parsedOpening,
      description,
      color,
      icon,
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={account ? "Edit account" : "Add account"}
      subtitle={account ? "Update how this account is labelled" : "Track another place your money is held"}
    >
      <label htmlFor="acc-name">Account name</label>
      <input
        id="acc-name"
        value={name}
        maxLength={80}
        placeholder="e.g. Main Cash Box, Shop Cash, Airtel Money"
        onChange={(event) => {
          setName(event.target.value);
          setLocalError("");
        }}
      />

      <label htmlFor="acc-kind">Account type</label>
      <select
        id="acc-kind"
        value={kind}
        onChange={(event) => setKind(event.target.value as typeof kind)}
      >
        {ACCOUNT_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>

      {account ? (
        <div className="account-fixed-balance">
          <small>Opening balance</small>
          <b>
            <MoneyText amount={account.opening_balance} className="inline-money" fit={false} />
          </b>
          <span>
            Opening balance is fixed after creation so the transaction history keeps adding up.
          </span>
        </div>
      ) : (
        <>
          <label htmlFor="acc-opening">Opening balance (UGX)</label>
          <input
            id="acc-opening"
            type="text"
            inputMode="numeric"
            value={opening}
            placeholder="e.g. 50000"
            onChange={(event) => {
              setOpening(event.target.value);
              setLocalError("");
            }}
          />
          <small className="account-field-help">
            Money already in this account today. Later money in and out is recorded as transactions.
          </small>
        </>
      )}

      <label htmlFor="acc-description">Description (optional)</label>
      <textarea
        id="acc-description"
        value={description}
        maxLength={300}
        rows={2}
        placeholder="e.g. Daily shop cash and change"
        onChange={(event) => setDescription(event.target.value)}
      />

      <label>Colour (optional)</label>
      <div className="account-swatches" role="group" aria-label="Account colour">
        {ACCOUNT_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={`account-swatch${color === swatch ? " on" : ""}`}
            style={{ background: swatch }}
            aria-label={`Use colour ${swatch}`}
            aria-pressed={color === swatch}
            onClick={() => setColor(color === swatch ? null : swatch)}
          />
        ))}
      </div>

      <label>Icon (optional)</label>
      <div className="opts account-icon-options" role="group" aria-label="Account icon">
        {ACCOUNT_ICON_CHOICES.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`opt${icon === option.value ? " on" : ""}`}
            aria-pressed={icon === option.value}
            onClick={() => setIcon(icon === option.value ? null : option.value)}
          >
            <Icon name={option.value as IconKey} size={18} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      <div className="err" role="alert">
        {localError || error || ""}
      </div>

      <button
        type="button"
        className="btn"
        disabled={busy}
        aria-busy={busy ? "true" : undefined}
        onClick={submit}
      >
        {busy ? (
          <>
            <Spinner /> Saving…
          </>
        ) : account ? (
          "Save changes"
        ) : (
          "Create account"
        )}
      </button>
    </BottomSheet>
  );
}

function TransferSheet({
  open,
  accounts,
  fromId,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  accounts: AccountSummary[];
  fromId: string | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (values: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    notes: string;
  }) => Promise<void>;
}) {
  const [from, setFrom] = useState(fromId ?? accounts[0]?.id ?? "");
  const [to, setTo] = useState(
    accounts.find((account) => account.id !== (fromId ?? accounts[0]?.id))?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState("");
  const fromAccount = accounts.find((account) => account.id === from);
  const destinationAccounts = accounts.filter((account) => account.id !== from);

  function submit() {
    const parsed = parseMoneyInput(amount);
    if (!from || !to) {
      setLocalError("Choose both accounts");
      return;
    }
    if (from === to) {
      setLocalError("Choose two different accounts");
      return;
    }
    if (parsed === null || parsed <= 0) {
      setLocalError("Enter an amount greater than zero");
      return;
    }
    if (fromAccount && parsed > fromAccount.balance) {
      setLocalError(
        `Only ${fromAccount.balance.toLocaleString("en-US")} UGX is available in ${fromAccount.name}`,
      );
      return;
    }
    setLocalError("");
    onSubmit({
      from_account_id: from,
      to_account_id: to,
      amount: parsed,
      notes,
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Transfer money"
      subtitle="Move money between your business accounts"
    >
      {accounts.length < 2 ? (
        <div className="empty-state">
          <b>Add another account first</b>
          <small>You need at least two active accounts to transfer money.</small>
        </div>
      ) : (
        <>
          <label htmlFor="tr-from">From</label>
          <select
            id="tr-from"
            value={from}
            onChange={(event) => {
              const next = event.target.value;
              setFrom(next);
              if (next === to) {
                setTo(accounts.find((account) => account.id !== next)?.id ?? "");
              }
              setLocalError("");
            }}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {Math.round(account.balance).toLocaleString("en-US")} UGX
              </option>
            ))}
          </select>

          <label htmlFor="tr-to">To</label>
          <select
            id="tr-to"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setLocalError("");
            }}
          >
            {destinationAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <label htmlFor="tr-amount">Amount (UGX)</label>
          <input
            id="tr-amount"
            type="text"
            inputMode="numeric"
            value={amount}
            placeholder="e.g. 20000"
            onChange={(event) => {
              setAmount(event.target.value);
              setLocalError("");
            }}
          />
          {fromAccount ? (
            <small className="account-field-help">
              Available in {fromAccount.name}:{" "}
              {Math.round(fromAccount.balance).toLocaleString("en-US")} UGX
            </small>
          ) : null}

          <label htmlFor="tr-notes">Note (optional)</label>
          <input
            id="tr-notes"
            value={notes}
            maxLength={200}
            placeholder="e.g. Banking today's sales"
            onChange={(event) => setNotes(event.target.value)}
          />

          <div className="err" role="alert">
            {localError || error || ""}
          </div>

          <button
            type="button"
            className="btn"
            disabled={busy}
            aria-busy={busy ? "true" : undefined}
            onClick={submit}
          >
            {busy ? (
              <>
                <Spinner /> Transferring…
              </>
            ) : (
              "Transfer money"
            )}
          </button>
          <small className="funds-sheet-note">
            A transfer records two linked movements: money out of one account and into the other.
            It is not income or an expense, so total funds stay the same.
          </small>
        </>
      )}
    </BottomSheet>
  );
}
