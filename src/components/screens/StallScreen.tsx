"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProductAction,
  setProductDiscountAction,
  setProductPublishedAction,
  updateProductAction,
} from "@/actions/business";
import { updateStallAction } from "@/actions/settings";
import { ProductSheet } from "@/components/screens/ProductSheet";
import { AdCarousel } from "@/components/ui/AdCarousel";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { MoneyText } from "@/components/ui/MoneyText";
import { Avatar } from "@/components/ui/Avatar";
import { ProductGallery } from "@/components/ui/ProductGallery";
import { Thumb } from "@/components/ui/Thumb";
import { useToast } from "@/components/ui/Toast";
import { STALL_COLORS } from "@/lib/constants";
import { colorNames, effectivePrice } from "@/lib/product";
import { productImages } from "@/lib/product-images";
import { POSTERS } from "@/lib/posters";
import type { StallData } from "@/lib/types";
import type { Product } from "@/types/app-db";

export function StallScreen({
  data,
  customCategories = [],
  initialCustomise = false,
}: {
  data: StallData;
  customCategories?: string[];
  initialCustomise?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { vendor, stall } = data;
  const [overrides, setOverrides] = useState<Record<string, Partial<Product>>>({});
  const products = data.products.map((product) => ({
    ...product,
    ...(overrides[product.id] ?? {}),
  }));
  const categoryOptions = Array.from(
    new Set([
      ...customCategories,
      ...(products.map((product) => product.category).filter(Boolean) as string[]),
    ]),
  );
  const published = products.filter((product) => product.is_active);
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [customOpen, setCustomOpen] = useState(initialCustomise);
  const [dealProduct, setDealProduct] = useState<(typeof products)[number] | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [name, setName] = useState(stall.name);
  const [tagline, setTagline] = useState(stall.tagline);
  const [color, setColor] = useState(stall.accent_color);
  const [discount, setDiscount] = useState("0");
  const [discountBusy, setDiscountBusy] = useState(false);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  function revertOverride(productId: string) {
    setOverrides((current) => {
      const copy = { ...current };
      delete copy[productId];
      return copy;
    });
  }

  async function togglePublished(productId: string, next: boolean) {
    if (pending[productId]) return;
    setPending((current) => ({ ...current, [productId]: true }));
    setOverrides((current) => ({ ...current, [productId]: { is_active: next } }));
    try {
      const result = await setProductPublishedAction(productId, next);
      if (!result.ok) {
        revertOverride(productId);
        toast(result.error ?? "Could not update listing");
        return;
      }
      toast(next ? "Now live on your stall" : "Hidden from your stall");
      router.refresh();
    } catch {
      revertOverride(productId);
      toast("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending((current) => {
        const copy = { ...current };
        delete copy[productId];
        return copy;
      });
    }
  }

  async function saveDiscount() {
    if (!dealProduct || discountBusy) return;
    const productId = dealProduct.id;
    setDiscountBusy(true);
    setOverrides((current) => ({
      ...current,
      [productId]: { discount_pct: Math.max(0, Math.min(90, Math.round(Number(discount) || 0))) },
    }));
    try {
      const result = await setProductDiscountAction(productId, Number(discount));
      if (!result.ok) {
        revertOverride(productId);
        toast(result.error ?? "Could not save discount");
        return;
      }
      setDealProduct(null);
      toast("Discount live on stall");
      router.refresh();
    } catch {
      revertOverride(productId);
      toast("Could not reach the server. Check your connection and try again.");
    } finally {
      setDiscountBusy(false);
    }
  }

  async function saveStall() {
    setBusy(true);
    try {
      const result = await updateStallAction({ name, tagline, accent_color: color });
      if (!result.ok) {
        toast(result.error ?? "Could not update stall");
        return;
      }
      setCustomOpen(false);
      toast("Stall updated");
      router.refresh();
    } catch {
      toast("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="stall-ad">
        <AdCarousel slides={POSTERS} />
      </div>

      <div className="stallhero" style={{ background: stall.accent_color }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar logoUrl={vendor.logo_url} name={vendor.business_name} size="stall" />
          <div>
            <h2>{stall.name}</h2>
            <p>{stall.tagline || ""}</p>
          </div>
        </div>
        {vendor.category ? (
          <p style={{ marginTop: 8 }}>
            {vendor.category}
            {vendor.region ? ` · ${vendor.region}` : ""}
          </p>
        ) : null}
        <p style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
          <Icon name="link" size={13} /> quonnect market · {published.length} product
          {published.length !== 1 ? "s" : ""} live
        </p>
      </div>

      <div className="btn-row">
        <button className="btn" onClick={() => setAddOpen(true)}>
          + Add product
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            setName(stall.name);
            setTagline(stall.tagline);
            setColor(stall.accent_color);
            setCustomOpen(true);
          }}
        >
          Customise
        </button>
      </div>

      <div className="card">
        <h3>Manage listings</h3>
        {products.length ? (
          products.map((product) => (
            <div className="row" key={product.id}>
              <Thumb product={product} />
              <div className="grow">
                <b>{product.name}</b>
                <small>
                  {product.stock} in stock
                  {colorNames(product.colors).length ? ` · ${colorNames(product.colors).join(", ")}` : ""}
                  {product.discount_pct ? ` · ${product.discount_pct}% off` : ""}
                  {product.sizes?.length ? ` · Sizes ${product.sizes.join(", ")}` : ""}
                </small>
              </div>
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
                onClick={() => {
                  setDealProduct(product);
                  setDiscount(String(product.discount_pct || 0));
                }}
              >
                Deal
              </button>
              <button
                type="button"
                className={`toggle ${product.is_active ? "on" : ""}`}
                role="switch"
                aria-checked={product.is_active}
                aria-label={`Publish ${product.name}`}
                aria-busy={Boolean(pending[product.id])}
                disabled={Boolean(pending[product.id])}
                onClick={() => togglePublished(product.id, !product.is_active)}
              />
            </div>
          ))
        ) : (
          <div className="empty">No products yet</div>
        )}
      </div>

      <div className="card">
        <h3>What customers see</h3>
        <div className="pgrid">
          {published.length ? (
            published.map((product) => (
              <button
                type="button"
                className="pcard"
                key={product.id}
                onClick={() => setViewProduct(product)}
                aria-label={`View ${product.name}`}
              >
                <Thumb product={product} />
                {productImages(product).length > 1 ? (
                  <span className="photo-count">{productImages(product).length} photos</span>
                ) : null}
                <b>{product.name}</b>
                {product.discount_pct ? (
                  <>
                    <span className="tag red">-{product.discount_pct}%</span>
                    <br />
                    <s>
                      <MoneyText amount={product.price} className="inline-money" fit={false} />
                    </s>
                    <br />
                  </>
                ) : null}
                <b style={{ color: stall.accent_color }}>
                  <MoneyText amount={effectivePrice(product)} className="inline-money" fit={false} />
                </b>
                <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 3 }}>
                  {product.stock > 0
                    ? [colorNames(product.colors).join(" · "), (product.sizes || []).join(" ")]
                        .filter(Boolean)
                        .join(" | ") || "In stock"
                    : "Sold out"}
                </div>
                {product.description ? (
                  <div className="clamp" style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 3 }}>
                    {product.description}
                  </div>
                ) : null}
              </button>
            ))
          ) : (
            <div className="empty" style={{ gridColumn: "1/3" }}>
              No products published
            </div>
          )}
        </div>
      </div>

      {addOpen ? (
        <ProductSheet
          key="add-open"
          open
          onClose={() => setAddOpen(false)}
          vendorId={vendor.id}
          busy={busy}
          title="Add product to stall"
          categories={categoryOptions}
          defaultPublished
          onSubmit={async (input) => {
            setBusy(true);
            const result = await createProductAction(input);
            setBusy(false);
            if (!result.ok) return toast(result.error ?? "Could not save product");
            setAddOpen(false);
            toast(input.is_published ? "Added and live on your stall" : "Item registered");
            router.refresh();
          }}
        />
      ) : null}

      {editProduct ? (
        <ProductSheet
          key={editProduct.id}
          open
          onClose={() => setEditProduct(null)}
          vendorId={vendor.id}
          busy={busy}
          product={editProduct}
          categories={categoryOptions}
          onSubmit={async (input) => {
            if (!editProduct) return;
            setBusy(true);
            const result = await updateProductAction({ id: editProduct.id, ...input });
            setBusy(false);
            if (!result.ok) return toast(result.error ?? "Could not update product");
            setEditProduct(null);
            toast("Product updated");
            router.refresh();
          }}
        />
      ) : null}

      <ProductGallery
        key={viewProduct?.id ?? "no-product"}
        product={viewProduct}
        onClose={() => setViewProduct(null)}
      />

      <BottomSheet
        open={Boolean(dealProduct)}
        onClose={() => setDealProduct(null)}
        title={dealProduct ? `Discount · ${dealProduct.name}` : "Discount"}
      >
        <label htmlFor="deal-discount">Discount %</label>
        <input
          id="deal-discount"
          type="number"
          inputMode="numeric"
          min="0"
          max="90"
          value={discount}
          onChange={(event) => setDiscount(event.target.value)}
        />
        <button
          type="button"
          className="btn"
          style={{ marginTop: 14 }}
          onClick={saveDiscount}
          disabled={discountBusy}
        >
          {discountBusy ? "Saving…" : "Apply"}
        </button>
      </BottomSheet>

      <BottomSheet open={customOpen} onClose={() => setCustomOpen(false)} title="Customise your stall">
        <label htmlFor="stall-name">Stall name</label>
        <input id="stall-name" value={name} onChange={(event) => setName(event.target.value)} />
        <label htmlFor="stall-tagline">Tagline</label>
        <input
          id="stall-tagline"
          value={tagline}
          onChange={(event) => setTagline(event.target.value)}
        />
        <label>Stall colour</label>
        <div>
          {STALL_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`sw ${color === swatch ? "on" : ""}`}
              style={{ background: swatch }}
              aria-label={`Use ${swatch}`}
              aria-pressed={color === swatch}
              onClick={() => setColor(swatch)}
            />
          ))}
        </div>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 14 }}
          onClick={saveStall}
          disabled={busy}
        >
          {busy ? "Saving…" : "Save and publish"}
        </button>
      </BottomSheet>
    </>
  );
}
