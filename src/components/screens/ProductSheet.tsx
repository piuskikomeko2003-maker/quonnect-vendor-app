"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { CLOTHING_SIZES, PRODUCT_CATEGORIES, SIZE_SETS } from "@/lib/constants";
import { resizeImageFile } from "@/lib/image";
import { uploadProductImage } from "@/lib/upload";

export function ProductSheet({
  open,
  onClose,
  vendorId,
  busy,
  title = "Register new item",
  defaultPublished = false,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  vendorId: string;
  busy: boolean;
  title?: string;
  defaultPublished?: boolean;
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
  const [published, setPublished] = useState(defaultPublished);
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
    <BottomSheet open={open} onClose={onClose} title={title}>
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
