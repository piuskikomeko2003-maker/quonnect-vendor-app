"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createProductAction, restockProductAction } from "@/actions/business";
import { ProductSheet } from "@/components/screens/ProductSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Thumb } from "@/components/ui/Thumb";
import { useToast } from "@/components/ui/Toast";
import { formatUGX } from "@/lib/format";
import { effectivePrice } from "@/lib/product";
import type { Product } from "@/types/app-db";

interface StockScreenProps {
  vendorId: string;
  products: Product[];
}

export function StockScreen({ vendorId, products }: StockScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState("All");
  const [productOpen, setProductOpen] = useState(false);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

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
    () => ["All", ...Array.from(new Set(products.map((product) => product.category).filter(Boolean) as string[]))],
    [products],
  );
  const activeCategory = categories.includes(category) ? category : "All";
  const list = products.filter(
    (product) => activeCategory === "All" || product.category === activeCategory,
  );

  return (
    <>
      <div className="snap">
        <small>Expected money if all stock sells</small>
        <div className="big">{formatUGX(totals.expected)}</div>
        <div className="two">
          <div>
            <small>Expected profit</small>
            <b>{formatUGX(totals.expected - totals.cost)}</b>
          </div>
          <div>
            <small>Stock cost</small>
            <b>{formatUGX(totals.cost)}</b>
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

      <button type="button" className="btn" style={{ marginBottom: 12 }} onClick={() => setProductOpen(true)}>
        + Register new item
      </button>

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
                    Cost {formatUGX(product.cost)} · Price {formatUGX(product.price)}
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
                  <button
                    type="button"
                    className="btn sm ghost"
                    style={{ marginTop: 6 }}
                    onClick={() => setRestockProduct(product)}
                  >
                    + Restock
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty">No items in this category</div>
        )}
      </div>

      <ProductSheet
        key={productOpen ? "product-open" : "product-closed"}
        open={productOpen}
        vendorId={vendorId}
        onClose={() => setProductOpen(false)}
        busy={busy}
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

      <RestockSheet
        key={restockProduct?.id ?? "none"}
        product={restockProduct}
        busy={busy}
        onClose={() => setRestockProduct(null)}
        onSubmit={async (quantity, cost, createExpense) => {
          if (!restockProduct) return;
          setBusy(true);
          const result = await restockProductAction(restockProduct.id, quantity, cost, createExpense);
          setBusy(false);
          if (!result.ok) {
            toast(result.error ?? "Could not restock");
            return;
          }
          setRestockProduct(null);
          toast(restockProduct.is_active ? "Stock updated on your online stall" : "Stock updated");
          router.refresh();
        }}
      />
    </>
  );
}

function RestockSheet({
  product,
  busy,
  onClose,
  onSubmit,
}: {
  product: Product | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (quantity: number, cost: number | null, createExpense: boolean) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [createExpense, setCreateExpense] = useState(true);

  return (
    <BottomSheet
      open={Boolean(product)}
      onClose={onClose}
      title={product ? `Restock ${product.name}` : "Restock"}
      subtitle={product ? `Currently ${product.stock} in stock` : undefined}
    >
      <label htmlFor="r-qty">Quantity received</label>
      <input
        id="r-qty"
        type="number"
        inputMode="numeric"
        value={quantity}
        onChange={(event) => setQuantity(event.target.value)}
        placeholder="e.g. 10"
      />
      <label htmlFor="r-cost">New cost per item (optional)</label>
      <input
        id="r-cost"
        type="number"
        inputMode="numeric"
        value={cost}
        onChange={(event) => setCost(event.target.value)}
        placeholder={product ? String(product.cost) : ""}
      />
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={createExpense}
          onChange={(event) => setCreateExpense(event.target.checked)}
          style={{ width: "auto" }}
        />
        Also record as stock-purchase expense
      </label>
      <button
        className="btn"
        style={{ marginTop: 14 }}
        disabled={busy}
        onClick={() => onSubmit(Number(quantity), cost ? Number(cost) : null, createExpense)}
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </BottomSheet>
  );
}
