"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordSaleAction, saveReceiptAction } from "@/actions/business";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatDay, formatUGX, todayKey } from "@/lib/format";
import { effectivePrice, productIcon } from "@/lib/product";
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

export function SellScreen({ products, recentSales, business }: SellScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const [cart, setCart] = useState<Record<string, CartEntry>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ReceiptSale | null>(null);
  const [receiptForm, setReceiptForm] = useState<ReceiptSale | null>(null);
  const [preview, setPreview] = useState<{ sale: ReceiptSale; canvas: HTMLCanvasElement; url: string } | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);

  const lines = Object.entries(cart)
    .map(([id, entry]) => {
      const product = products.find((item) => item.id === id);
      return product ? { product, ...entry } : null;
    })
    .filter(Boolean) as { product: Product; qty: number; soldPrice: string }[];

  const total = lines.reduce((sum, line) => sum + (Number(line.soldPrice) || 0) * line.qty, 0);

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
    if (!lines.length) return;
    if (lines.some((line) => !(Number(line.soldPrice) > 0))) {
      toast("Enter a selling price");
      return;
    }
    setBusy(true);
    const result = await recordSaleAction(
      lines.map((line) => ({
        product_id: line.product.id,
        qty: line.qty,
        sold_price: Number(line.soldPrice),
      })),
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
      customerName: "",
      customerPhone: "",
      items: result.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        listed: item.listed,
        sold: item.sold,
        cost: item.cost,
      })),
    };
    setCart({});
    setDone(sale);
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
      <div className="chips" role="list" aria-label="Products">
        {products.map((product) => (
          <button
            type="button"
            key={product.id}
            className={`chip ${product.stock <= 0 ? "out" : ""}`}
            onClick={() => addToCart(product)}
            role="listitem"
          >
            {product.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.photo_url} alt="" />
            ) : (
              <Icon name={productIcon(product)} size={18} />
            )}{" "}
            {product.name}
            <small>
              {formatUGX(effectivePrice(product))} · {product.stock} in stock
            </small>
          </button>
        ))}
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
                  <small style={{ display: "block" }}>Listed {formatUGX(listed)}</small>
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
                      <span className="neg">{formatUGX(-difference)} below listed price</span>
                    ) : difference > 0 ? (
                      <span className="pos">{formatUGX(difference)} above listed price</span>
                    ) : null}
                    {sold > 0 && sold < line.product.cost ? (
                      <span style={{ color: "var(--amber)" }}>
                        {" "}
                        · below your cost ({formatUGX(line.product.cost)})
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
            <b style={{ fontSize: 17 }}>{formatUGX(total)}</b>
          </div>
        ) : null}
      </div>

      {lines.length ? (
        <button className="btn" onClick={recordSale} disabled={busy}>
          {busy ? "Recording…" : `Record sale · ${formatUGX(total)}`}
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
                  <b>{formatUGX(sale.total)}</b>
                  <small>{sale.sale_date}</small>
                  {receipt.items.map((item) => (
                    <small style={{ display: "block" }} key={`${sale.id}-${item.name}`}>
                      {item.qty}× {item.name}
                      {item.sold !== item.listed ? (
                        <>
                          {" "}
                          @ {formatUGX(item.sold)}{" "}
                          <span className={item.sold < item.listed ? "neg" : "pos"}>
                            (listed {formatUGX(item.listed)})
                          </span>
                        </>
                      ) : null}
                    </small>
                  ))}
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="tag">+{formatUGX(sale.profit)}</span>
                  <br />
                  <button
                    type="button"
                    className="btn sm ghost"
                    style={{ marginTop: 6 }}
                    onClick={() => openReceipt(receipt)}
                  >
                    Receipt
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty">No sales yet</div>
        )}
      </div>

      <BottomSheet open={Boolean(done)} onClose={() => setDone(null)}>
        {done ? (
          <div style={{ textAlign: "center" }}>
            <div className="bigav" style={{ width: 64, height: 64 }}>
              <Icon name="check" size={34} />
            </div>
            <h2 style={{ marginTop: 10 }}>Sale recorded</h2>
            <div style={{ fontSize: 26, fontWeight: 800, margin: "4px 0" }}>{formatUGX(done.total)}</div>
            {done.priceReduction > 0 ? (
              <small style={{ color: "var(--amber)" }}>
                {formatUGX(done.priceReduction)} below listed price noted
              </small>
            ) : (
              <small style={{ color: "var(--mut)" }}>Stock updated</small>
            )}
            <button className="btn" style={{ marginTop: 18 }} onClick={() => openReceipt(done)}>
              <Icon name="receipt" size={16} /> Generate receipt
            </button>
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setDone(null)}>
              Not now
            </button>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={Boolean(receiptForm)}
        onClose={() => setReceiptForm(null)}
        title={receiptForm ? `Receipt ${receiptNumber(receiptForm.id)}` : "Receipt"}
        subtitle={receiptForm ? `${formatUGX(receiptForm.total)} · ${formatDay(receiptForm.date)}` : undefined}
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
    </>
  );
}
