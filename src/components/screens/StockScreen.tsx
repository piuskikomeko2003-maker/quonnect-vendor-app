"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addProductCategoryAction,
  createProductAction,
  deleteProductCategoryAction,
  updateProductAction,
} from "@/actions/business";
import { recordStockPurchaseAction, reverseStockPurchaseAction } from "@/actions/purchases";
import { ProductSheet } from "@/components/screens/ProductSheet";
import { RestockPurchaseSheet } from "@/components/screens/RestockPurchaseSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { MoneyText } from "@/components/ui/MoneyText";
import { SuccessSheet, type SuccessFact } from "@/components/ui/SuccessSheet";
import { Thumb } from "@/components/ui/Thumb";
import { useToast } from "@/components/ui/Toast";
import { formatDay, formatMoney } from "@/lib/format";
import { effectivePrice } from "@/lib/product";
import type { StockPurchaseInput } from "@/lib/action-types";
import type { AccountsData, PurchasesData, StockPurchaseRecord } from "@/lib/types";
import type { Product } from "@/types/app-db";

interface StockScreenProps {
  vendorId: string;
  products: Product[];
  accounts: AccountsData;
  purchases: PurchasesData;
  customCategories?: string[];
  initialAdd?: boolean;
  initialRestockProductId?: string | null;
}

export function StockScreen({
  vendorId,
  products,
  accounts,
  purchases,
  customCategories = [],
  initialAdd = false,
  initialRestockProductId = null,
}: StockScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState("All");
  const [productOpen, setProductOpen] = useState(initialAdd);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(Boolean(initialRestockProductId));
  const [restockProductId, setRestockProductId] = useState<string | null>(
    initialRestockProductId,
  );
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    message: string;
    facts: SuccessFact[];
    warning?: string;
  } | null>(null);
  const [reverseTarget, setReverseTarget] = useState<StockPurchaseRecord | null>(null);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [reverseError, setReverseError] = useState("");

  const activeAccounts = accounts.accounts.filter((account) => account.is_active);

  const totals = useMemo(() => {
    return products.reduce(
      (accumulator, product) => ({
        cost: accumulator.cost + Number(product.cost) * Number(product.stock),
        expected: accumulator.expected + effectivePrice(product) * Number(product.stock),
        units: accumulator.units + Number(product.stock),
      }),
      { cost: 0, expected: 0, units: 0 },
    );
  }, [products]);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set([
          ...customCategories,
          ...(products.map((product) => product.category).filter(Boolean) as string[]),
        ]),
      ),
    ],
    [customCategories, products],
  );
  const activeCategory = categories.includes(category) ? category : "All";
  const list = products.filter(
    (product) => activeCategory === "All" || product.category === activeCategory,
  );

  function openPurchase(productId: string | null = null) {
    setRestockProductId(productId);
    setPurchaseError("");
    setPurchaseOpen(true);
  }

  async function savePurchase(input: StockPurchaseInput) {
    setPurchaseBusy(true);
    const result = await recordStockPurchaseAction(input);
    setPurchaseBusy(false);
    if (!result.ok) {
      setPurchaseError(result.error ?? "Could not save this purchase");
      return;
    }

    const purchase = result.purchase;
    setPurchaseOpen(false);
    setPurchaseError("");

    if (!purchase) {
      toast("Purchase saved");
      router.refresh();
      return;
    }

    const units = input.items.reduce((total, line) => total + Number(line.quantity || 0), 0);
    const names = input.items
      .map((line) => products.find((product) => product.id === line.product_id)?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");
    const facts: SuccessFact[] = [
      { label: "Reference", value: purchase.reference_no ?? "Stock purchase" },
      {
        label: "Stock updated",
        value: `${units} unit${units === 1 ? "" : "s"} added${names ? ` · ${names}` : ""}`,
      },
      {
        label: "Total purchase cost",
        value: <MoneyText amount={purchase.total_amount} className="inline-money" fit={false} />,
      },
      {
        label: "Amount paid",
        value: <MoneyText amount={purchase.paid_amount} className="inline-money" fit={false} />,
        tone: purchase.paid_amount > 0 ? "neg" : "muted",
      },
      {
        label: "Payment account",
        value:
          purchase.paid_amount > 0
            ? purchase.account_name ?? "Selected account"
            : "Credit · no money moved",
      },
    ];

    if (purchase.account_balance_after !== null) {
      facts.push({
        label: "Updated account balance",
        value: (
          <MoneyText amount={purchase.account_balance_after} className="inline-money" fit={false} />
        ),
      });
    }

    facts.push({
      label: "Outstanding supplier balance",
      value: <MoneyText amount={purchase.due_amount} className="inline-money" fit={false} />,
      tone: purchase.due_amount > 0 ? "neg" : "muted",
    });

    setConfirmation({
      title: purchase.duplicate ? "Purchase already saved" : "Purchase recorded",
      message: purchase.duplicate
        ? "This purchase was saved earlier. Stock and account balances were not changed twice."
        : "Stock quantities are now updated and the payment is recorded.",
      facts,
    });
    router.refresh();
  }

  async function reversePurchase() {
    if (!reverseTarget) return;
    setReverseBusy(true);
    const result = await reverseStockPurchaseAction(reverseTarget.id);
    setReverseBusy(false);
    if (!result.ok || !result.reversal) {
      setReverseError(result.error ?? "Could not reverse this purchase");
      return;
    }

    const reversal = result.reversal;
    setReverseTarget(null);
    setReverseError("");

    const facts: SuccessFact[] = [
      { label: "Reference", value: reversal.reference_no ?? "Stock purchase" },
      {
        label: "Stock reversed",
        value: `${reversal.items_reversed} purchase line${reversal.items_reversed === 1 ? "" : "s"} removed from stock`,
      },
      {
        label: "Amount refunded",
        value: <MoneyText amount={reversal.refunded_amount} className="inline-money" fit={false} />,
        tone: "pos",
      },
      {
        label: "Refunded to",
        value: reversal.account_name ?? "No payment was made",
      },
    ];

    if (reversal.account_balance_after !== null) {
      facts.push({
        label: "Updated account balance",
        value: (
          <MoneyText
            amount={reversal.account_balance_after}
            className="inline-money"
            fit={false}
          />
        ),
      });
    }

    setConfirmation({
      title: "Purchase reversed",
      message:
        "Stock was reduced and the supplier balance was removed. The original purchase and its reversal can be seen under Business accounts.",
      facts,
    });
    router.refresh();
  }

  async function addCategory() {
    if (!newCategory.trim()) {
      setCategoryError("Enter a category name");
      return;
    }
    setCategoryBusy(true);
    const result = await addProductCategoryAction(newCategory);
    setCategoryBusy(false);
    if (!result.ok) {
      setCategoryError(result.error ?? "Could not add category");
      return;
    }
    setNewCategory("");
    setCategoryError("");
    toast("Category added");
    router.refresh();
  }

  async function removeCategory(name: string) {
    setCategoryBusy(true);
    const result = await deleteProductCategoryAction(name);
    setCategoryBusy(false);
    if (!result.ok) {
      setCategoryError(result.error ?? "Could not remove category");
      return;
    }
    toast("Category removed");
    router.refresh();
  }

  return (
    <>
      <div className="snap">
        <small>Expected money if all stock sells</small>
        <div className="big">
          <MoneyText amount={totals.expected} />
        </div>
        <div className="two">
          <div>
            <small>Expected profit</small>
            <b><MoneyText amount={totals.expected - totals.cost} className="inline-money" /></b>
          </div>
          <div>
            <small>Stock cost</small>
            <b><MoneyText amount={totals.cost} className="inline-money" /></b>
          </div>
        </div>
        <div className="two">
          <div>
            <small>Items</small>
            <b>{products.length}</b>
          </div>
          <div>
            <small>Units in stock</small>
            <b>{totals.units}</b>
          </div>
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: 12 }}>
        <button type="button" className="btn" onClick={() => openPurchase()}>
          + Restock products
        </button>
        <button type="button" className="btn ghost" onClick={() => setProductOpen(true)}>
          + Register new item
        </button>
      </div>

      <div className="opts" style={{ margin: "0 0 12px" }} role="group" aria-label="Filter by category">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={`opt ${item === activeCategory ? "on" : ""}`}
            aria-pressed={item === activeCategory}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          className="opt add-category-opt"
          onClick={() => {
            setCategoryError("");
            setCategoryOpen(true);
          }}
        >
          + New category
        </button>
      </div>

      <div className="card">
        {list.length ? (
          list.map((product) => {
            const meta = [product.category, product.sizes?.length ? `Sizes ${product.sizes.join(", ")}` : ""]
              .filter(Boolean)
              .join(" · ");
            return (
              <div className="row" key={product.id}>
                <Thumb product={product} />
                <div className="grow">
                  <b>{product.name}</b>
                  <small style={{ display: "block" }}>{meta}</small>
                  <small style={{ display: "block" }}>
                    Cost {formatMoney(product.cost)} · Price {formatMoney(product.price)}
                  </small>
                  {product.description ? (
                    <small className="clamp" style={{ display: "block" }}>
                      {product.description}
                    </small>
                  ) : null}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`tag ${product.stock <= 0 ? "red" : product.stock <= 3 ? "amb" : ""}`}>
                    {product.stock} left
                  </span>
                  <br />
                  <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => setEditProduct(product)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn sm ghost"
                      onClick={() => openPurchase(product.id)}
                    >
                      + Restock
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : products.length === 0 ? (
          <EmptyState
            icon="box"
            title="No products registered yet"
            description="Register your first item to start tracking stock, costs and restocking."
            actionLabel="Register your first item"
            onAction={() => setProductOpen(true)}
          />
        ) : (
          <EmptyState
            icon="box"
            title={`No items in ${activeCategory}`}
            description="Try another category or move an existing item into this one."
            actionLabel="Show all products"
            onAction={() => setCategory("All")}
          />
        )}
      </div>

      <section className="surface" style={{ marginTop: 12 }} aria-label="Supplier balances">
        <div className="surface-head">
          <span className="icon-circle">
            <Icon name="coins" size={20} />
          </span>
          <div className="grow">
            <b className="surface-title">Supplier balances</b>
            <small className="surface-sub">Stock received but not fully paid</small>
          </div>
          <span className="pill">
            <MoneyText amount={purchases.outstanding} className="inline-money" fit={false} />
          </span>
        </div>
        {purchases.supplierPayables.length ? (
          <div className="purchase-payables">
            {purchases.supplierPayables.map((payable) => (
              <div className="purchase-payable-row" key={payable.supplier_name}>
                <div className="grow">
                  <b>{payable.supplier_name}</b>
                  <small>
                    {payable.purchase_count} purchase{payable.purchase_count === 1 ? "" : "s"}
                    {payable.last_purchase_date
                      ? ` · last ${formatDay(payable.last_purchase_date)}`
                      : ""}
                  </small>
                </div>
                <b className="neg">
                  <MoneyText
                    amount={payable.due_amount}
                    className="inline-money"
                    fit={false}
                  />
                </b>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No outstanding supplier balances</div>
        )}
      </section>

      <section className="surface" aria-label="Recent stock purchases">
        <div className="surface-head">
          <span className="icon-circle">
            <Icon name="box" size={20} />
          </span>
          <div className="grow">
            <b className="surface-title">Recent stock purchases</b>
            <small className="surface-sub">Stock received and how it was paid</small>
          </div>
        </div>
        {purchases.purchases.length ? (
          <div className="purchase-history">
            {purchases.purchases.slice(0, 8).map((purchase) => (
              <div className="purchase-history-row" key={purchase.id}>
                <div className="grow">
                  <b>
                    {purchase.supplier_name || "Stock purchase"}{" "}
                    <span className="tag">{purchase.reference_no ?? "Purchase"}</span>
                  </b>
                  <small>
                    {formatDay(purchase.purchase_date)} ·{" "}
                    {purchase.items.length
                      ? purchase.items
                          .slice(0, 3)
                          .map((item) => `${item.quantity} × ${item.product_name ?? "item"}`)
                          .join(", ")
                      : "No items"}
                  </small>
                  <small>
                    Total{" "}
                    <MoneyText
                      amount={purchase.total_amount}
                      className="inline-money"
                      fit={false}
                    />{" "}
                    · Paid{" "}
                    <MoneyText
                      amount={purchase.paid_amount}
                      className="inline-money"
                      fit={false}
                    />{" "}
                    · Due{" "}
                    <MoneyText
                      amount={purchase.due_amount}
                      className="inline-money"
                      fit={false}
                    />
                    {purchase.account_name ? ` · ${purchase.account_name}` : " · Credit"}
                  </small>
                  <button
                    type="button"
                    className="link danger purchase-reverse"
                    onClick={() => {
                      setReverseError("");
                      setReverseTarget(purchase);
                    }}
                  >
                    Reverse purchase
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="box"
            title="No stock purchases recorded yet"
            description="Record a restock to add stock and track what you paid your supplier."
            actionLabel="Restock products"
            onAction={() => openPurchase()}
          />
        )}
      </section>

      <ProductSheet
        key={productOpen ? "product-open" : "product-closed"}
        open={productOpen}
        vendorId={vendorId}
        onClose={() => setProductOpen(false)}
        busy={busy}
        categories={categories.filter((item) => item !== "All")}
        onSubmit={async (input) => {
          setBusy(true);
          const result = await createProductAction(input);
          setBusy(false);
          if (!result.ok) {
            toast(result.error ?? "Could not save item");
            return;
          }
          setProductOpen(false);
          toast(input.is_published ? "Added and live on your stall" : "Item registered");
          router.refresh();
        }}
      />

      {editProduct ? (
        <ProductSheet
          key={editProduct.id}
          open
          vendorId={vendorId}
          busy={busy}
          product={editProduct}
          categories={categories.filter((item) => item !== "All")}
          onClose={() => setEditProduct(null)}
          onSubmit={async (input) => {
            if (!editProduct) return;
            setBusy(true);
            const result = await updateProductAction({ id: editProduct.id, ...input });
            setBusy(false);
            if (!result.ok) {
              toast(result.error ?? "Could not update item");
              return;
            }
            setEditProduct(null);
            toast(input.is_published ? "Item updated and live on your stall" : "Item updated");
            router.refresh();
          }}
        />
      ) : null}

      <RestockPurchaseSheet
        key={`purchase-${purchaseOpen ? restockProductId ?? "all" : "closed"}`}
        open={purchaseOpen}
        products={products}
        accounts={activeAccounts}
        initialProductId={restockProductId}
        busy={purchaseBusy}
        error={purchaseError}
        onClose={() => setPurchaseOpen(false)}
        onSubmit={savePurchase}
      />
      <BottomSheet
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title="Product categories"
        subtitle="Add your own categories for stock items"
      >
        <label htmlFor="pc-name">New category</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            id="pc-name"
            value={newCategory}
            onChange={(event) => {
              setNewCategory(event.target.value);
              setCategoryError("");
            }}
            placeholder="e.g. Phone accessories"
          />
          <button
            type="button"
            className="btn"
            style={{ width: "auto", flexShrink: 0, padding: "10px 16px" }}
            onClick={addCategory}
            disabled={categoryBusy}
          >
            Add
          </button>
        </div>
        <div className="err" role="alert">
          {categoryError}
        </div>

        <div className="lbl">Your custom categories</div>
        {customCategories.length ? (
          customCategories.map((item) => (
            <div className="row" key={item}>
              <div className="grow">
                <b>{item}</b>
              </div>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => removeCategory(item)}
                disabled={categoryBusy}
              >
                Remove
              </button>
            </div>
          ))
        ) : (
          <div className="empty">No custom categories yet</div>
        )}
        <small style={{ display: "block", color: "var(--mut)", fontSize: 11, lineHeight: 1.5, marginTop: 8 }}>
          Default categories are always available. Removing a custom category does not change
          products that already use it.
        </small>
      </BottomSheet>

      <ConfirmSheet
        open={Boolean(reverseTarget)}
        onClose={() => {
          if (!reverseBusy) setReverseTarget(null);
        }}
        title="Reverse this stock purchase?"
        description="The stock added by this purchase will be removed. If you paid anything, the money will be refunded to the same account. The purchase and its reversal stay in your history."
        confirmLabel="Reverse purchase"
        busy={reverseBusy}
        error={reverseError}
        onConfirm={reversePurchase}
      >
        {reverseTarget ? (
          <dl className="success-facts">
            <div>
              <dt>Reference</dt>
              <dd>{reverseTarget.reference_no ?? "Stock purchase"}</dd>
            </div>
            <div>
              <dt>Supplier</dt>
              <dd>{reverseTarget.supplier_name || "Unspecified"}</dd>
            </div>
            <div>
              <dt>Stock to remove</dt>
              <dd>
                {reverseTarget.items.reduce((total, item) => total + Number(item.quantity || 0), 0)}{" "}
                units
              </dd>
            </div>
            <div>
              <dt>Refund</dt>
              <dd>
                <MoneyText amount={reverseTarget.paid_amount} className="inline-money" fit={false} />
              </dd>
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
