"use client";

import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { MoneyText } from "@/components/ui/MoneyText";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import {
  newPurchaseKey,
  purchaseGrandTotal,
  purchaseLineTotal,
  purchaseOutstanding,
  purchasePaymentStatus,
  validatePurchasePayment,
} from "@/lib/purchases";
import { formatDay, todayKey } from "@/lib/format";
import { isValidEntryDate, parseMoneyInput, parseWholeInput } from "@/lib/validation";
import type { AccountSummary } from "@/lib/types";
import type { StockPurchaseInput } from "@/lib/action-types";
import type { Product } from "@/types/app-db";

interface DraftLine {
  product_id: string;
  quantity: string;
  unit_cost: string;
}

function initialLine(product: Product | undefined): DraftLine[] {
  if (!product) return [];
  return [
    {
      product_id: product.id,
      quantity: "1",
      unit_cost: String(Math.round(Number(product.cost) || 0)),
    },
  ];
}

export function RestockPurchaseSheet({
  open,
  products,
  accounts,
  initialProductId = null,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  products: Product[];
  accounts: AccountSummary[];
  initialProductId?: string | null;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (input: StockPurchaseInput) => Promise<void>;
}) {
  const firstProduct = useMemo(
    () => products.find((product) => product.id === initialProductId),
    [initialProductId, products],
  );
  const [lines, setLines] = useState<DraftLine[]>(() => initialLine(firstProduct));
  const [selectedProduct, setSelectedProduct] = useState("");
  const [supplier, setSupplier] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [paid, setPaid] = useState<string | null>(null);
  const [purchaseDate, setPurchaseDate] = useState(todayKey());
  const [notes, setNotes] = useState("");
  const [localError, setLocalError] = useState("");
  const [idempotencyKey] = useState(() => newPurchaseKey());

  const lineTotals = useMemo(
    () =>
      lines.map((line) =>
        purchaseLineTotal({
          quantity: line.quantity,
          unit_cost: line.unit_cost,
        }),
      ),
    [lines],
  );
  const total = useMemo(() => purchaseGrandTotal(lines), [lines]);
  const paidValue = paid ?? (total > 0 ? String(total) : "");
  const paidNumber = paidValue.trim() === "" ? 0 : parseMoneyInput(paidValue) ?? 0;
  const outstanding = purchaseOutstanding(total, paidNumber);
  const status = purchasePaymentStatus(total, paidNumber);
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null;

  const availableProducts = products.filter(
    (product) => !lines.some((line) => line.product_id === product.id),
  );

  function addProduct() {
    const product = products.find((item) => item.id === selectedProduct);
    if (!product) {
      setLocalError("Choose a product to add");
      return;
    }
    setLines((current) => [
      ...current,
      {
        product_id: product.id,
        quantity: "1",
        unit_cost: String(Math.round(Number(product.cost) || 0)),
      },
    ]);
    setSelectedProduct("");
    setLocalError("");
  }

  function updateLine(productId: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.product_id === productId ? { ...line, ...patch } : line)),
    );
    setLocalError("");
  }

  function removeLine(productId: string) {
    setLines((current) => current.filter((line) => line.product_id !== productId));
    setLocalError("");
  }

  function setPaidValue(value: string) {
    setPaid(value);
    setLocalError("");
  }

  function submit() {
    if (!lines.length) {
      setLocalError("Add at least one product to the purchase");
      return;
    }

    const parsedLines = lines.map((line) => ({
      product_id: line.product_id,
      quantity: parseWholeInput(line.quantity),
      unit_cost: parseMoneyInput(line.unit_cost),
    }));
    const invalidLine = parsedLines.find(
      (line) =>
        line.quantity === null ||
        line.quantity < 1 ||
        line.unit_cost === null ||
        line.unit_cost < 0,
    );
    if (invalidLine) {
      setLocalError(
        "Enter a whole quantity greater than zero and a valid cost for every product",
      );
      return;
    }

    if (!isValidEntryDate(purchaseDate)) {
      setLocalError("Choose a purchase date that is today or earlier");
      return;
    }

    const enteredPaid = paidValue.trim();
    const parsedPaid = enteredPaid === "" ? 0 : parseMoneyInput(enteredPaid);
    if (parsedPaid === null) {
      setLocalError("Enter a valid amount paid");
      return;
    }

    const paymentError = validatePurchasePayment(
      total,
      parsedPaid,
      accountId || null,
      selectedAccount?.balance ?? null,
    );
    if (paymentError) {
      setLocalError(paymentError);
      return;
    }

    setLocalError("");
    onSubmit({
      items: parsedLines.map((line) => ({
        product_id: line.product_id,
        quantity: line.quantity as number,
        unit_cost: line.unit_cost as number,
      })),
      account_id: parsedPaid > 0 ? accountId : null,
      amount_paid: parsedPaid,
      supplier_name: supplier,
      purchase_date: purchaseDate,
      notes,
      idempotency_key: idempotencyKey,
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Record stock purchase"
      subtitle="Add products, confirm costs and record how much you paid"
    >
      <div className="purchase-step">
        <span className="purchase-step-number">1</span>
        <div className="grow">
          <b>Select products</b>
          <small>Choose what you received from the supplier</small>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="empty">Register a product before restocking.</div>
      ) : (
        <>
          <div className="purchase-add-row">
            <select
              value={selectedProduct}
              onChange={(event) => {
                setSelectedProduct(event.target.value);
                setLocalError("");
              }}
              aria-label="Product to add"
            >
              <option value="">Choose a product</option>
              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {product.stock} in stock
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn sm"
              disabled={!selectedProduct}
              onClick={addProduct}
            >
              <Icon name="plus" size={15} /> Add
            </button>
          </div>

          <div className="purchase-lines">
            {lines.length ? (
              lines.map((line, index) => {
                const product = products.find((item) => item.id === line.product_id);
                return (
                  <div className="purchase-line" key={line.product_id}>
                    <div className="purchase-line-head">
                      <div className="grow">
                        <b>{product?.name ?? "Product"}</b>
                        <small>{product ? `${product.stock} currently in stock` : ""}</small>
                      </div>
                      <button
                        type="button"
                        className="link danger"
                        onClick={() => removeLine(line.product_id)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="purchase-line-fields">
                      <label>
                        <span>Quantity</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(line.product_id, { quantity: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Cost per item (UGX)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={line.unit_cost}
                          onChange={(event) =>
                            updateLine(line.product_id, { unit_cost: event.target.value })
                          }
                        />
                      </label>
                      <div className="purchase-line-total">
                        <small>Line total</small>
                        <b>
                          <MoneyText
                            amount={lineTotals[index]}
                            className="inline-money"
                            fit={false}
                          />
                        </b>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="empty">No products selected yet</div>
            )}
          </div>
        </>
      )}

      <div className="purchase-step">
        <span className="purchase-step-number">2</span>
        <div className="grow">
          <b>Payment</b>
          <small>Choose the account used to pay and enter the amount paid</small>
        </div>
      </div>

      <label htmlFor="p-account">Payment account</label>
      <select
        id="p-account"
        value={accountId}
        onChange={(event) => {
          setAccountId(event.target.value);
          setLocalError("");
        }}
      >
        {accounts.length ? (
          accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} · {Math.round(account.balance).toLocaleString("en-US")} UGX available
            </option>
          ))
        ) : (
          <option value="">No active accounts</option>
        )}
      </select>
      {selectedAccount ? (
        <small className="account-field-help">
          Available in {selectedAccount.name}:{" "}
          {Math.round(selectedAccount.balance).toLocaleString("en-US")} UGX
        </small>
      ) : (
        <small className="account-field-help">
          Add an account from Business accounts to record a paid purchase. You can still record a
          fully credit purchase.
        </small>
      )}

      <label htmlFor="p-paid">Amount paid (UGX)</label>
      <input
        id="p-paid"
        type="text"
        inputMode="numeric"
        value={paidValue}
        placeholder="e.g. 50000"
        onChange={(event) => setPaidValue(event.target.value)}
      />
      <div className="purchase-pay-actions">
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => setPaidValue(String(total))}
          disabled={!total}
        >
          Paid in full
        </button>
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => setPaidValue("0")}
        >
          Pay later
        </button>
      </div>

      <label htmlFor="p-supplier">Supplier (optional)</label>
      <input
        id="p-supplier"
        value={supplier}
        maxLength={120}
        placeholder="e.g. Kikuubo Wholesalers"
        onChange={(event) => setSupplier(event.target.value)}
      />

      <label htmlFor="p-date">Purchase date</label>
      <input
        id="p-date"
        type="date"
        max={todayKey()}
        value={purchaseDate}
        onChange={(event) => setPurchaseDate(event.target.value)}
      />

      <label htmlFor="p-notes">Note (optional)</label>
      <input
        id="p-notes"
        value={notes}
        maxLength={500}
        placeholder="e.g. Received 2 boxes"
        onChange={(event) => setNotes(event.target.value)}
      />

      <div className="purchase-summary" aria-live="polite">
        <div>
          <small>Total purchase cost</small>
          <b>
            <MoneyText amount={total} className="inline-money" fit={false} />
          </b>
        </div>
        <div>
          <small>Amount paid now</small>
          <b className="pos">
            <MoneyText amount={paidNumber} className="inline-money" fit={false} />
          </b>
        </div>
        <div>
          <small>Outstanding supplier balance</small>
          <b className={outstanding > 0 ? "neg" : ""}>
            <MoneyText amount={outstanding} className="inline-money" fit={false} />
          </b>
        </div>
        <div>
          <small>Payment account</small>
          <b>{paidNumber > 0 ? selectedAccount?.name ?? "No account" : "Credit · no money moved"}</b>
        </div>
        <div>
          <small>Status</small>
          <b>
            {status === "paid" ? "Fully paid" : status === "partial" ? "Part paid" : "On credit"}
          </b>
        </div>
      </div>

      <div className="err" role="alert">
        {localError || error || ""}
      </div>

      <button
        type="button"
        className="btn"
        disabled={busy || !lines.length}
        aria-busy={busy ? "true" : undefined}
        onClick={submit}
      >
        {busy ? (
          <>
            <Spinner /> Saving purchase…
          </>
        ) : (
          "Save purchase"
        )}
      </button>
      <small className="funds-sheet-note">
        Stock increases immediately. Only the amount paid leaves the selected account; the rest is
        recorded as an outstanding supplier balance.
      </small>
      <small className="funds-sheet-note">
        Saved on {purchaseDate ? formatDay(purchaseDate) : "today"}. If you tap save twice, the same
        purchase is saved once.
      </small>
    </BottomSheet>
  );
}
