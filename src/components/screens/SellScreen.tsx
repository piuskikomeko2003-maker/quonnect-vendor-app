"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordSaleAction, reverseSaleAction, saveReceiptAction } from "@/actions/business";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { MoneyText } from "@/components/ui/MoneyText";
import { Spinner } from "@/components/ui/Spinner";
import { SuccessSheet, type SuccessFact } from "@/components/ui/SuccessSheet";
import { Thumb } from "@/components/ui/Thumb";
import { useToast } from "@/components/ui/Toast";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatDay, formatMoney, todayKey } from "@/lib/format";
import { parseMoneyInput } from "@/lib/validation";
import { effectivePrice, productIcon } from "@/lib/product";
import { coverImageUrl } from "@/lib/product-images";
import {
  buildReceipt,
  downloadCanvas,
  receiptNumber,
  receiptText,
  shareCanvas,
  whatsappNumber,
  type ReceiptBusiness,
} from "@/lib/receipt";
import type { ReceiptSale, SaleWithItems } from "@/lib/types";
import type { Product, SaleItem } from "@/types/app-db";

interface CartEntry {
  qty: number;
  soldPrice: string;
}

interface SellScreenProps {
  products: Product[];
  recentSales: SaleWithItems[];
  business: ReceiptBusiness;
}

function toReceiptSale(sale: SaleWithItems): ReceiptSale {
  return {
    id: sale.id,
    orderNo: sale.order_no,
    date: sale.sale_date,
    total: Number(sale.total),
    profit: Number(sale.profit),
    priceReduction: Number(sale.price_reduction || 0),
    paymentMethod: sale.payment_method || "Cash",
    customerName: sale.customer_name ?? "",
    customerPhone: sale.customer_phone ?? "",
    items: sale.items.map((item: SaleItem) => ({
      name: item.product_name,
      qty: Number(item.quantity),
      listed: Number(item.listed_price || item.unit_price),
      sold: Number(item.sold_price || item.unit_price),
      cost: Number(item.unit_cost),
    })),
  };
}

function saleSuccessFacts(sale: ReceiptSale): SuccessFact[] {
  const units = sale.items.reduce((total, item) => total + Number(item.qty || 0), 0);
  const facts: SuccessFact[] = [
    {
      label: "Amount received",
      value: <MoneyText amount={sale.total} className="inline-money" fit={false} />,
      tone: "pos",
    },
    {
      label: "Items sold",
      value: `${units} item${units === 1 ? "" : "s"} · stock updated`,
    },
    { label: "Payment method", value: sale.paymentMethod },
    {
      label: "Profit on this sale",
      value: <MoneyText amount={sale.profit} className="inline-money" fit={false} />,
    },
  ];

  if (sale.customerName) {
    facts.push({ label: "Customer", value: sale.customerName });
  }
  if (sale.priceReduction > 0) {
    facts.push({
      label: "Below listed price",
      value: <MoneyText amount={sale.priceReduction} className="inline-money" fit={false} />,
      tone: "neg",
    });
  }

  return facts;
}

export function SellScreen({ products, recentSales, business }: SellScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ReceiptSale | null>(null);
  const [saleWarning, setSaleWarning] = useState("");
  const [reverseTarget, setReverseTarget] = useState<SaleWithItems | null>(null);
  const [reverseBusy, setReverseBusy] = useState(false);
  const [reverseError, setReverseError] = useState("");
  const [reversalConfirmation, setReversalConfirmation] = useState<{
    title: string;
    message: string;
    facts: SuccessFact[];
  } | null>(null);
  const [receiptForm, setReceiptForm] = useState<ReceiptSale | null>(null);
  const [preview, setPreview] = useState<{ sale: ReceiptSale; canvas: HTMLCanvasElement; url: string } | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const lines = Object.entries(cart)
    .map(([id, entry]) => {
      const product = products.find((item) => item.id === id);
      return product ? { product, ...entry } : null;
    })
    .filter(Boolean) as { product: Product; qty: number; soldPrice: string }[];

  const total = lines.reduce((sum, line) => sum + (Number(line.soldPrice) || 0) * line.qty, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  const search = query.trim().toLowerCase();
  const pickable = products.filter(
    (product) =>
      !search ||
      product.name.toLowerCase().includes(search) ||
      (product.category ?? "").toLowerCase().includes(search),
  );

  function addToCart(product: Product) {
    if (product.stock <= 0) {
      toast("Not enough stock");
      return;
    }
    setCart((current) => {
      const existing = current[product.id];
      if (existing && existing.qty >= product.stock) {
        toast("Not enough stock");
        return current;
      }
      return {
        ...current,
        [product.id]: existing
          ? { ...existing, qty: existing.qty + 1 }
          : { qty: 1, soldPrice: String(effectivePrice(product)) },
      };
    });
  }

  function changeQty(product: Product, delta: number) {
    setCart((current) => {
      const existing = current[product.id];
      if (!existing) return current;
      const next = existing.qty + delta;
      if (next > product.stock) {
        toast("Not enough stock");
        return current;
      }
      const copy = { ...current };
      if (next <= 0) delete copy[product.id];
      else copy[product.id] = { ...existing, qty: next };
      return copy;
    });
  }

  function setPrice(productId: string, value: string) {
    setCart((current) => ({
      ...current,
      [productId]: { ...current[productId], soldPrice: value },
    }));
  }

  async function recordSale() {
    if (!lines.length) {
      toast("Add at least one item to the sale");
      return;
    }
    const invalidPrice = lines.find((line) => {
      const price = parseMoneyInput(line.soldPrice);
      return price === null || price <= 0;
    });
    if (invalidPrice) {
      toast(`Enter a valid selling price for ${invalidPrice.product.name}`);
      return;
    }
    const invalidQuantity = lines.find(
      (line) => !Number.isInteger(line.qty) || line.qty < 1 || line.qty > line.product.stock,
    );
    if (invalidQuantity) {
      toast(`Check the quantity for ${invalidQuantity.product.name}`);
      return;
    }
    setBusy(true);
    const result = await recordSaleAction(
      lines.map((line) => ({
        product_id: line.product.id,
        qty: line.qty,
        sold_price: parseMoneyInput(line.soldPrice) as number,
      })),
      { name: customerName, phone: customerPhone },
    );
    setBusy(false);
    if (!result.ok || !result.sale || !result.items) {
      toast(result.error ?? "Could not record the sale");
      return;
    }
    const sale: ReceiptSale = {
      id: result.sale.id,
      orderNo: result.sale.order_no,
      date: todayKey(),
      total: result.sale.total,
      profit: result.sale.profit,
      priceReduction: result.sale.price_reduction,
      paymentMethod: result.sale.payment_method,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: result.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        listed: item.listed,
        sold: item.sold,
        cost: item.cost,
      })),
    };
    if (result.warning) setSaleWarning(result.warning);
    else setSaleWarning("");
    setCart({});
    setAddOpen(false);
    setCustomerName("");
    setCustomerPhone("");
    setDone(sale);
    router.refresh();
  }

  async function reverseSale() {
    if (!reverseTarget) return;
    setReverseBusy(true);
    const result = await reverseSaleAction(reverseTarget.id);
    setReverseBusy(false);
    if (!result.ok || !result.reversal) {
      setReverseError(result.error ?? "Could not reverse this sale");
      return;
    }

    const reversal = result.reversal;
    setReverseTarget(null);
    setReverseError("");

    const facts: SuccessFact[] = [
      { label: "Sale", value: reversal.order_no || "Sale" },
      {
        label: "Sale total",
        value: <MoneyText amount={reversal.total} className="inline-money" fit={false} />,
      },
      {
        label: "Stock restored",
        value: `${reversal.items_reversed} item${reversal.items_reversed === 1 ? "" : "s"} returned to stock`,
      },
      {
        label: "Amount refunded",
        value: (
          <MoneyText amount={reversal.refunded_amount} className="inline-money" fit={false} />
        ),
        tone: reversal.refunded_amount > 0 ? "neg" : "muted",
      },
      {
        label: "Refunded from",
        value: reversal.account_name ?? "No money had been received",
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

    setReversalConfirmation({
      title: "Sale reversed",
      message:
        "Stock was returned and any money received was refunded. The original sale and its reversal can be seen under Business accounts.",
      facts,
    });
    router.refresh();
  }

  function openReceipt(sale: ReceiptSale) {
    setDone(null);
    setReceiptForm(sale);
  }

  async function createReceipt() {
    if (!receiptForm) return;
    setReceiptBusy(true);
    const saved = await saveReceiptAction({
      sale_id: receiptForm.id,
      customer_name: receiptForm.customerName,
      customer_phone: receiptForm.customerPhone,
      payment_method: receiptForm.paymentMethod,
    });
    if (!saved.ok) {
      setReceiptBusy(false);
      toast(saved.error ?? "Could not save receipt details");
      return;
    }
    try {
      const canvas = await buildReceipt(receiptForm, business);
      setPreview({ sale: receiptForm, canvas, url: canvas.toDataURL("image/png") });
      setReceiptForm(null);
    } catch {
      toast("Could not build the receipt");
    } finally {
      setReceiptBusy(false);
    }
  }

  return (
    <>
      {!products.length ? (
        <div className="card">
          <EmptyState
            icon="basket"
            title="No products to sell yet"
            description="Register your first item or restock existing stock before recording a sale."
            actionLabel="Go to my stock"
            actionHref="/stock"
          />
        </div>
      ) : null}
      <div className="chips" role="list" aria-label="Products">
        {products.map((product) => (
          <button
            type="button"
            key={product.id}
            className={`chip ${product.stock <= 0 ? "out" : ""}`}
            onClick={() => addToCart(product)}
            role="listitem"
          >
            {coverImageUrl(product) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageUrl(product) ?? ""} alt="" />
            ) : (
              <Icon name={productIcon(product)} size={18} />
            )}{" "}
            {product.name}
            <small>
              {formatMoney(effectivePrice(product))} · {product.stock} in stock
            </small>
          </button>
        ))}
      </div>

      <div className="card">
        <h3>
          Customer <span>Optional</span>
        </h3>
        <div className="customer-fields">
          <div>
            <label htmlFor="sale-customer-name">Customer name</label>
            <input
              id="sale-customer-name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="e.g. Sarah"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="sale-customer-phone">Contact / WhatsApp</label>
            <input
              id="sale-customer-phone"
              type="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
              placeholder="+256 7XX XXX XXX"
              autoComplete="off"
            />
          </div>
        </div>
        <small className="customer-hint">
          Add a customer to link this sale to their history.
        </small>
      </div>

      <div className="card">
        <h3>
          Cart <span>You can change the sold price</span>
        </h3>
        {lines.length ? (
          lines.map((line) => {
            const listed = effectivePrice(line.product);
            const sold = Number(line.soldPrice) || 0;
            const difference = sold - listed;
            return (
              <div className="row" style={{ alignItems: "flex-start" }} key={line.product.id}>
                <div className="grow">
                  <b>{line.product.name}</b>
                  <small style={{ display: "block" }}>Listed {formatMoney(listed)}</small>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 11.5, color: "var(--mut)" }}>Sold at</span>
                    <input
                      className="pin"
                      type="number"
                      inputMode="numeric"
                      value={line.soldPrice}
                      aria-label={`Sold at price for ${line.product.name}`}
                      onChange={(event) => setPrice(line.product.id, event.target.value)}
                    />
                  </div>
                  <small style={{ display: "block", marginTop: 4 }}>
                    {difference < 0 ? (
                      <span className="neg">{formatMoney(-difference)} below listed price</span>
                    ) : difference > 0 ? (
                      <span className="pos">{formatMoney(difference)} above listed price</span>
                    ) : null}
                    {sold > 0 && sold < line.product.cost ? (
                      <span style={{ color: "var(--amber)" }}>
                        {" "}
                        · below your cost ({formatMoney(line.product.cost)})
                      </span>
                    ) : null}
                  </small>
                </div>
                <div className="qty">
                  <button type="button" onClick={() => changeQty(line.product, -1)} aria-label="Decrease quantity">
                    −
                  </button>
                  <b>{line.qty}</b>
                  <button type="button" onClick={() => changeQty(line.product, 1)} aria-label="Increase quantity">
                    +
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty">Cart is empty. Tap a product above.</div>
        )}
        {lines.length ? (
          <div className="row">
            <div className="grow">
              <b>Total</b>
            </div>
            <b style={{ fontSize: 17, minWidth: 0 }}>
              <MoneyText amount={total} className="inline-money" fit={false} />
            </b>
          </div>
        ) : null}
      </div>

      {lines.length ? (
        <button className="btn" onClick={recordSale} disabled={busy} aria-busy={busy ? "true" : undefined}>
          {busy ? (
            <>
              <Spinner /> Recording…
            </>
          ) : (
            `Record sale · ${formatMoney(total)}`
          )}
        </button>
      ) : null}

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Recent sales</h3>
        {recentSales.length ? (
          recentSales.map((sale) => {
            const receipt = toReceiptSale(sale);
            return (
              <div className="row" key={sale.id}>
                <div className="grow">
                  <b>{formatMoney(sale.total)}</b>
                  <small>{sale.sale_date}</small>
                  {receipt.items.map((item) => (
                    <small style={{ display: "block" }} key={`${sale.id}-${item.name}`}>
                      {item.qty}× {item.name}
                      {item.sold !== item.listed ? (
                        <>
                          {" "}
                          @ {formatMoney(item.sold)}{" "}
                          <span className={item.sold < item.listed ? "neg" : "pos"}>
                            (listed {formatMoney(item.listed)})
                          </span>
                        </>
                      ) : null}
                    </small>
                  ))}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="tag">+{formatMoney(sale.profit)}</span>
                  <br />
                  <button
                    type="button"
                    className="btn sm ghost"
                    style={{ marginTop: 6 }}
                    onClick={() => openReceipt(receipt)}
                  >
                    Receipt
                  </button>
                  <button
                    type="button"
                    className="link danger"
                    style={{ display: "block", marginLeft: "auto", marginTop: 6, fontSize: 11.5 }}
                    onClick={() => {
                      setReverseError("");
                      setReverseTarget(sale);
                    }}
                  >
                    Void sale
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState
            icon="receipt"
            title="No sales recorded yet"
            description="Tap a product above or use the + button to build your first sale. Stock and money update automatically."
          />
        )}
      </div>

      <div style={{ height: 54 }} aria-hidden />

      <button
        type="button"
        className="fab"
        aria-label="Add a sale"
        onClick={() => {
          setQuery("");
          setAddOpen(true);
        }}
      >
        <Icon name="plus" size={26} />
      </button>

      <BottomSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a sale"
        subtitle="Tap an item to add it to this sale"
      >
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search items"
          aria-label="Search items"
          style={{ marginTop: 10 }}
        />
        <div style={{ maxHeight: "46vh", overflowY: "auto" }}>
          {pickable.length ? (
            pickable.map((product) => {
              const inCart = cart[product.id]?.qty ?? 0;
              const out = product.stock <= 0;
              return (
                <div className="row" key={product.id}>
                  <Thumb product={product} />
                  <div className="grow">
                    <b>{product.name}</b>
                    <small style={{ display: "block" }}>
                      {formatMoney(effectivePrice(product))} · {product.stock} in stock
                      {inCart ? ` · ${inCart} in this sale` : ""}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn sm ghost"
                    disabled={out}
                    onClick={() => addToCart(product)}
                    aria-label={`Add ${product.name} to the sale`}
                  >
                    {out ? "Out" : "+ Add"}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="empty">No items match “{query}”</div>
          )}
        </div>
        <div className="row" style={{ borderBottom: 0 }}>
          <div className="grow">
            <small>In this sale</small>
            <b>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </b>
          </div>
          <b style={{ fontSize: 17, minWidth: 0 }}>
            <MoneyText amount={total} className="inline-money" fit={false} />
          </b>
        </div>
        <button
          className="btn"
          disabled={!lines.length || busy}
          aria-busy={busy ? "true" : undefined}
          onClick={recordSale}
        >
          {busy ? (
            <>
              <Spinner /> Recording…
            </>
          ) : lines.length ? (
            `Record sale · ${formatMoney(total)}`
          ) : (
            "Add an item to start"
          )}
        </button>
      </BottomSheet>

      <SuccessSheet
        open={Boolean(done)}
        onClose={() => setDone(null)}
        title="Sale recorded"
        message="The sale is saved and stock quantities have been updated."
        facts={done ? saleSuccessFacts(done) : []}
        warning={saleWarning || undefined}
        closeLabel="Not now"
        actions={
          done ? (
            <button className="btn" onClick={() => openReceipt(done)}>
              <Icon name="receipt" size={16} /> Generate receipt
            </button>
          ) : null
        }
      />

      <BottomSheet
        open={Boolean(receiptForm)}
        onClose={() => setReceiptForm(null)}
        title={receiptForm ? `Receipt ${receiptNumber(receiptForm.id)}` : "Receipt"}
        subtitle={receiptForm ? `${formatMoney(receiptForm.total)} · ${formatDay(receiptForm.date)}` : undefined}
      >
        {receiptForm ? (
          <>
            <label htmlFor="rc-name">Customer name (optional)</label>
            <input
              id="rc-name"
              value={receiptForm.customerName}
              onChange={(event) =>
                setReceiptForm({ ...receiptForm, customerName: event.target.value })
              }
              placeholder="e.g. Sarah"
            />
            <label htmlFor="rc-phone">Customer WhatsApp number (optional)</label>
            <input
              id="rc-phone"
              type="tel"
              value={receiptForm.customerPhone}
              onChange={(event) =>
                setReceiptForm({ ...receiptForm, customerPhone: event.target.value })
              }
              placeholder="+256 7XX XXX XXX"
            />
            <label>Paid with</label>
            <div className="opts">
              {PAYMENT_METHODS.map((method) => (
                <button
                  type="button"
                  key={method}
                  className={`opt ${receiptForm.paymentMethod === method ? "on" : ""}`}
                  aria-pressed={receiptForm.paymentMethod === method}
                  onClick={() => setReceiptForm({ ...receiptForm, paymentMethod: method })}
                >
                  {method}
                </button>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 16 }} onClick={createReceipt} disabled={receiptBusy}>
              {receiptBusy ? "Creating…" : "Create receipt"}
            </button>
          </>
        ) : null}
      </BottomSheet>

      <BottomSheet open={Boolean(preview)} onClose={() => setPreview(null)} title="Receipt ready">
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.url}
              alt={`Receipt ${receiptNumber(preview.sale.id)}`}
              style={{ width: "100%", borderRadius: 12, border: "1px solid var(--line)", margin: "10px 0 12px" }}
            />
            <button
              className="btn"
              onClick={async () => {
                const shared = await shareCanvas(preview.canvas, preview.sale.id, business.stallName);
                if (!shared) toast("Receipt downloaded");
              }}
            >
              <Icon name="share" size={16} /> Share (WhatsApp, Instagram, more)
            </button>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                className="btn ghost"
                onClick={() => {
                  const number = whatsappNumber(preview.sale.customerPhone);
                  window.open(
                    `https://wa.me/${number}?text=${encodeURIComponent(receiptText(preview.sale, business))}`,
                    "_blank",
                  );
                }}
              >
                <Icon name="whatsapp" size={16} /> WhatsApp text
              </button>
              <button
                className="btn ghost"
                onClick={() => {
                  downloadCanvas(preview.canvas, preview.sale.id);
                  toast("Receipt downloaded");
                }}
              >
                <Icon name="download" size={16} /> Download
              </button>
            </div>
            <button className="link" style={{ marginTop: 10, width: "100%" }} onClick={() => setPreview(null)}>
              Done
            </button>
          </>
        ) : null}
      </BottomSheet>

      <ConfirmSheet
        open={Boolean(reverseTarget)}
        onClose={() => {
          if (!reverseBusy) setReverseTarget(null);
        }}
        title="Void this sale?"
        description="All items in this sale will be returned to stock and any money received will be refunded to the account that received it. The sale and its reversal stay in your history."
        confirmLabel="Void this sale"
        busy={reverseBusy}
        error={reverseError}
        onConfirm={reverseSale}
      >
        {reverseTarget ? (
          <dl className="success-facts">
            <div>
              <dt>Sale</dt>
              <dd>{reverseTarget.order_no}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                <MoneyText amount={reverseTarget.total} className="inline-money" fit={false} />
              </dd>
            </div>
            <div>
              <dt>Items</dt>
              <dd>
                {reverseTarget.items.reduce((total, item) => total + Number(item.quantity || 0), 0)}{" "}
                units
              </dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{reverseTarget.customer_name || "Walk-in customer"}</dd>
            </div>
          </dl>
        ) : null}
      </ConfirmSheet>

      <SuccessSheet
        open={Boolean(reversalConfirmation)}
        onClose={() => setReversalConfirmation(null)}
        title={reversalConfirmation?.title ?? "Sale reversed"}
        message={reversalConfirmation?.message}
        facts={reversalConfirmation?.facts ?? []}
      />
    </>
  );
}
