"use client";

import { useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { CLOTHING_SIZES, PRODUCT_CATEGORIES, SIZE_SETS } from "@/lib/constants";
import { resizeImageFile } from "@/lib/image";
import {
  addProductImages,
  MAX_PRODUCT_IMAGES,
  moveProductImage,
  productImages,
  removeProductImage,
  setCoverProductImage,
} from "@/lib/product-images";
import { uploadProductImage } from "@/lib/upload";
import { parseMoneyInput, parseWholeInput } from "@/lib/validation";
import type { Product } from "@/types/app-db";

export function ProductSheet({
  open,
  onClose,
  vendorId,
  busy,
  title,
  product = null,
  categories,
  defaultPublished = false,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  vendorId: string;
  busy: boolean;
  title?: string;
  product?: Product | null;
  categories?: string[];
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
    photo_urls: string[];
  }) => Promise<void>;
}) {
  const toast = useToast();
  const categoryOptions = Array.from(
    new Set([
      ...(categories?.length ? categories : PRODUCT_CATEGORIES),
      ...(product?.category ? [product.category] : []),
    ]),
  );
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<string>(product?.category ?? categoryOptions[0] ?? "Other");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [sizes, setSizes] = useState<string[]>(product?.sizes ?? []);
  const [extraSizes, setExtraSizes] = useState("");
  const [colors, setColors] = useState((product?.colors ?? []).join(", "));
  const [description, setDescription] = useState(product?.description ?? "");
  const [cost, setCost] = useState(product ? String(product.cost) : "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [quantity, setQuantity] = useState(product ? String(product.stock) : "");
  const [discount, setDiscount] = useState(String(product?.discount_pct ?? 0));
  const [published, setPublished] = useState(product ? product.is_active : defaultPublished);
  const [photoUrls, setPhotoUrls] = useState<string[]>(() => productImages(product ?? {}));
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const sheetTitle = title ?? (product ? "Edit product" : "Register new item");
  const selectedCategory = addingCategory ? newCategory.trim() : category;

  const sizeOptions = SIZE_SETS[selectedCategory] ?? CLOTHING_SIZES;

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

  function removePhoto(index: number) {
    setPhotoUrls((current) => removeProductImage(current, index));
  }

  function movePhoto(index: number, direction: -1 | 1) {
    setPhotoUrls((current) => moveProductImage(current, index, index + direction));
  }

  function makeCover(index: number) {
    setPhotoUrls((current) => setCoverProductImage(current, index));
  }

  async function onPhotos(files: File[]) {
    if (!files.length || uploading) return;

    const room = MAX_PRODUCT_IMAGES - photoUrls.length;
    if (room <= 0) {
      toast(`You can add up to ${MAX_PRODUCT_IMAGES} photos`);
      return;
    }
    if (files.length > room) {
      toast(`Only ${room} more photo${room === 1 ? "" : "s"} can be added`);
    }

    setUploading(true);
    const uploaded: string[] = [];
    try {
      for (const file of files.slice(0, room)) {
        try {
          const { blob } = await resizeImageFile(file, 900, 0.78);
          const result = await uploadProductImage(blob, vendorId);
          if (result.error || !result.url) {
            toast(result.error ?? "Could not upload photo");
          } else {
            uploaded.push(result.url);
          }
        } catch {
          toast("Could not use that image");
        }
      }
      if (uploaded.length) {
        setPhotoUrls((current) => addProductImages(current, uploaded));
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    const cleanName = name.trim();
    const cleanCategory = selectedCategory.trim();
    const parsedPrice = parseMoneyInput(price);
    const parsedCost = cost.trim() === "" ? 0 : parseMoneyInput(cost);
    const parsedQuantity = quantity.trim() === "" ? 0 : parseWholeInput(quantity);
    const parsedDiscount = discount.trim() === "" ? 0 : parseWholeInput(discount);

    if (!cleanName) {
      setLocalError("Enter an item name");
      return;
    }
    if (!cleanCategory) {
      setLocalError("Choose or type a category");
      return;
    }
    if (parsedPrice === null || parsedPrice <= 0) {
      setLocalError("Enter a selling price greater than zero");
      return;
    }
    if (parsedCost === null || parsedCost < 0) {
      setLocalError("Enter a valid cost price, or leave it blank");
      return;
    }
    if (parsedQuantity === null || parsedQuantity < 0) {
      setLocalError("Enter a whole quantity, or leave it blank");
      return;
    }
    if (parsedDiscount === null || parsedDiscount < 0 || parsedDiscount > 90) {
      setLocalError("Discount must be a whole number between 0 and 90");
      return;
    }

    setLocalError("");
    const extra = extraSizes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    await onSubmit({
      name: cleanName,
      category: cleanCategory,
      sizes: Array.from(new Set([...sizes, ...extra])),
      colors: colors
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      description,
      cost: parsedCost,
      price: parsedPrice,
      quantity: parsedQuantity,
      discount_pct: parsedDiscount,
      is_published: published,
      photo_urls: photoUrls,
    });
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={sheetTitle}>
      <label htmlFor="p-name">Item name</label>
      <input id="p-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Ankara Shirt" />
      <label>Product photos</label>
      <div className="photo-grid">
        {photoUrls.map((url, index) => (
          <div className={`photo-tile ${index === 0 ? "cover" : ""}`} key={url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Product photo ${index + 1}`} />
            {index === 0 ? (
              <span className="photo-badge">Cover</span>
            ) : (
              <button
                type="button"
                className="photo-cover-btn"
                onClick={() => makeCover(index)}
              >
                Set cover
              </button>
            )}
            <div className="photo-tools">
              <button
                type="button"
                onClick={() => movePhoto(index, -1)}
                disabled={index === 0}
                aria-label={`Move photo ${index + 1} earlier`}
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => movePhoto(index, 1)}
                disabled={index === photoUrls.length - 1}
                aria-label={`Move photo ${index + 1} later`}
              >
                ›
              </button>
              <button
                type="button"
                className="photo-remove"
                onClick={() => removePhoto(index)}
                aria-label={`Delete photo ${index + 1}`}
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {photoUrls.length < MAX_PRODUCT_IMAGES ? (
          <button
            type="button"
            className={`photo-add ${uploading ? "busy" : ""}`}
            onClick={() => photoInputRef.current?.click()}
            disabled={uploading}
          >
            <Icon name="camera" size={20} />
            <span>{uploading ? "Uploading…" : "Add photos"}</span>
            <small>
              {photoUrls.length}/{MAX_PRODUCT_IMAGES}
            </small>
          </button>
        ) : null}
      </div>
      <input
        ref={photoInputRef}
        type="file"
        id="p-photo"
        accept="image/*"
        multiple
        hidden
        disabled={uploading}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void onPhotos(files);
        }}
      />
      <small className="photo-hint">
        Add up to {MAX_PRODUCT_IMAGES} photos. The first photo is the cover customers see first.
      </small>
      <label htmlFor="p-category">Category</label>
      <select
        id="p-category"
        value={addingCategory ? "__new__" : category}
        onChange={(event) => {
          if (event.target.value === "__new__") {
            setAddingCategory(true);
            setNewCategory("");
            setSizes([]);
            return;
          }
          setAddingCategory(false);
          changeCategory(event.target.value);
        }}
      >
        {categoryOptions.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
        <option value="__new__">+ Add new category</option>
      </select>
      {addingCategory ? (
        <input
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
          placeholder="New category name"
          aria-label="New category name"
          style={{ marginTop: 8 }}
        />
      ) : null}
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
      <div className="err" role="alert">
        {localError}
      </div>
      <button
        type="button"
        className="btn"
        style={{ marginTop: 14 }}
        onClick={submit}
        disabled={busy || uploading}
        aria-busy={busy ? "true" : undefined}
      >
        {busy ? (
          <>
            <Spinner /> Saving…
          </>
        ) : product ? (
          "Save changes"
        ) : (
          "Save item"
        )}
      </button>
    </BottomSheet>
  );
}
