"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProductAction,
  setProductDiscountAction,
  setProductPublishedAction,
} from "@/actions/business";
import { updateStallAction } from "@/actions/settings";
import { ProductSheet } from "@/components/screens/ProductSheet";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/Avatar";
import { Thumb } from "@/components/ui/Thumb";
import { useToast } from "@/components/ui/Toast";
import { STALL_COLORS } from "@/lib/constants";
import { formatUGX } from "@/lib/format";
import { effectivePrice } from "@/lib/product";
import type { StallData } from "@/lib/types";

export function StallScreen({ data }: { data: StallData }) {
  const router = useRouter();
  const toast = useToast();
  const { vendor, stall, products } = data;
  const published = products.filter((product) => product.is_active);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [dealProduct, setDealProduct] = useState<(typeof products)[number] | null>(null);
  const [name, setName] = useState(stall.name);
  const [tagline, setTagline] = useState(stall.tagline);
  const [color, setColor] = useState(stall.accent_color);
  const [discount, setDiscount] = useState("0");

  async function togglePublished(productId: string, next: boolean) {
    const result = await setProductPublishedAction(productId, next);
    if (!result.ok) return toast(result.error ?? "Could not update listing");
    toast(next ? "Now live on your stall" : "Hidden from your stall");
    router.refresh();
  }

  async function saveDiscount() {
    if (!dealProduct) return;
    const result = await setProductDiscountAction(dealProduct.id, Number(discount));
    if (!result.ok) return toast(result.error ?? "Could not save discount");
    setDealProduct(null);
    toast("Discount live on stall");
    router.refresh();
  }

  async function saveStall() {
    setBusy(true);
    const result = await updateStallAction({ name, tagline, accent_color: color });
    setBusy(false);
    if (!result.ok) return toast(result.error ?? "Could not update stall");
    setCustomOpen(false);
    toast("Stall updated");
    router.refresh();
  }

  return (
    <>
      <div className="stallhero" style={{ background: stall.accent_color }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Avatar logoUrl={vendor.logo_url} name={vendor.business_name} />
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
                  {product.colors?.length ? ` · ${product.colors.join(", ")}` : ""}
                  {product.discount_pct ? ` · ${product.discount_pct}% off` : ""}
                  {product.sizes?.length ? ` · Sizes ${product.sizes.join(", ")}` : ""}
                </small>
              </div>
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
              <div className="pcard" key={product.id}>
                <Thumb product={product} />
                <b>{product.name}</b>
                {product.discount_pct ? (
                  <>
                    <span className="tag red">-{product.discount_pct}%</span>
                    <br />
                    <s>{formatUGX(product.price)}</s>
                    <br />
                  </>
                ) : null}
                <b style={{ color: stall.accent_color }}>{formatUGX(effectivePrice(product))}</b>
                <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 3 }}>
                  {product.stock > 0
                    ? [product.colors?.join(" · "), (product.sizes || []).join(" ")]
                        .filter(Boolean)
                        .join(" | ") || "In stock"
                    : "Sold out"}
                </div>
                {product.description ? (
                  <div className="clamp" style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 3 }}>
                    {product.description}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="empty" style={{ gridColumn: "1/3" }}>
              No products published
            </div>
          )}
        </div>
      </div>

      <ProductSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        vendorId={vendor.id}
        busy={busy}
        title="Add product to stall"
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
        <button className="btn" style={{ marginTop: 14 }} onClick={saveDiscount}>
          Apply
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
        <button className="btn" style={{ marginTop: 14 }} onClick={saveStall} disabled={busy}>
          {busy ? "Saving…" : "Save and publish"}
        </button>
      </BottomSheet>
    </>
  );
}
