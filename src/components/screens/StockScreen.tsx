"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProductAction,
  restockProductAction,
} from "@/actions/business";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { Thumb } from "@/components/ui/Thumb";
import { useToast } from "@/components/ui/Toast";
import { CLOTHING_SIZES, PRODUCT_CATEGORIES, SIZE_SETS } from "@/lib/constants";
import { formatUGX } from "@/lib/format";
import { resizeImageFile } from "@/lib/image";
import { effectivePrice } from "@/lib/product";
import { uploadProductImage } from "@/lib/upload";
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

function ProductSheet({
  open,
  onClose,
  vendorId,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  vendorId: string;
  busy: boolean;
  onSubmit: (input: {
    name: string;
    category: string;
    sizes: string[];
    colors: string[];
    description: string;
    cost: number;
    price: number;
    quantity: number;
    discount_pct: number;
    is_published: boolean;
    photo_url: string | null;
  }) => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>("Shoes");
  const [sizes, setSizes] = useState<string[]>([]);
  const [extraSizes, setExtraSizes] = useState("");
  const [colors, setColors] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [discount, setDiscount] = useState("0");
  const [published, setPublished] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const sizeOptions = SIZE_SETS[category] ?? CLOTHING_SIZES;

  function changeCategory(next: string) {
    setCategory(next);
    const allowed = SIZE_SETS[next] ?? CLOTHING_SIZES;
    setSizes((current) => current.filter((size) => allowed.includes(size)));
  }

  function toggleSize(size: string) {
    setSizes((current) =>
      current.includes(size) ? current.filter((item) => item !== size) : [...current, size],
    );
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const { blob } = await resizeImageFile(file, 420, 0.72);
      const result = await uploadProductImage(blob, vendorId);
      if (result.error || !result.url) {
        toast(result.error ?? "Could not upload photo");
      } else {
        setPhotoUrl(result.url);
      }
    } catch {
      toast("Could not use that image");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    const extra = extraSizes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    await onSubmit({
      name,
      category,
      sizes: Array.from(new Set([...sizes, ...extra])),
      colors: colors
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      description,
      cost: Number(cost) || 0,
      price: Number(price) || 0,
      quantity: Number(quantity) || 0,
      discount_pct: Number(discount) || 0,
      is_published: published,
      photo_url: photoUrl,
    });
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Register new item">
      <label htmlFor="p-name">Item name</label>
      <input id="p-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ankara Shirt" />
      <label>Product photo</label>
      <label className="upl" htmlFor="p-photo">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="Product photo preview" />
        ) : (
          <>
            <Icon name="camera" size={28} />
            {uploading ? "Uploading…" : "Tap to add a photo"}
          </>
        )}
      </label>
      <input
        type="file"
        id="p-photo"
        accept="image/*"
        hidden
        onChange={(event) => onPhoto(event.target.files?.[0])}
      />
      <label htmlFor="p-category">Category</label>
      <select id="p-category" value={category} onChange={(event) => changeCategory(event.target.value)}>
        {PRODUCT_CATEGORIES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <label>Sizes available (tap to select)</label>
      <div className="opts">
        {sizeOptions.map((size) => (
          <button
            key={size}
            type="button"
            className={`opt ${sizes.includes(size) ? "on" : ""}`}
            aria-pressed={sizes.includes(size)}
            onClick={() => toggleSize(size)}
          >
            {size}
          </button>
        ))}
      </div>
      <input
        value={extraSizes}
        onChange={(event) => setExtraSizes(event.target.value)}
        placeholder="Other sizes, comma separated (optional)"
        style={{ marginTop: 8 }}
        aria-label="Other sizes"
      />
      <label htmlFor="p-colors">Colours (comma separated)</label>
      <input id="p-colors" value={colors} onChange={(event) => setColors(event.target.value)} placeholder="Red, Blue, Black" />
      <label htmlFor="p-desc">Description</label>
      <textarea
        id="p-desc"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Material, fit, care, anything customers should know"
      />
      <label htmlFor="p-cost">Cost price (UGX)</label>
      <input id="p-cost" type="number" inputMode="numeric" value={cost} onChange={(event) => setCost(event.target.value)} />
      <label htmlFor="p-price">Selling price (UGX)</label>
      <input id="p-price" type="number" inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} />
      <label htmlFor="p-qty">Quantity</label>
      <input id="p-qty" type="number" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      <label htmlFor="p-discount">Discount % (optional)</label>
      <input id="p-discount" type="number" inputMode="numeric" value={discount} onChange={(event) => setDiscount(event.target.value)} />
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
          style={{ width: "auto" }}
        />
        Show on my online stall
      </label>
      <button className="btn" style={{ marginTop: 14 }} onClick={submit} disabled={busy || uploading}>
        {busy ? "Saving…" : "Save item"}
      </button>
    </BottomSheet>
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
