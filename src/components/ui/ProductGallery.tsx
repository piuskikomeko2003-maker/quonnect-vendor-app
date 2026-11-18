"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Icon } from "@/components/ui/Icon";
import { MoneyText } from "@/components/ui/MoneyText";
import { colorNames, effectivePrice } from "@/lib/product";
import { productImages } from "@/lib/product-images";
import type { Product } from "@/types/app-db";

export function ProductGallery({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const images = product ? productImages(product) : [];
  const active = images[Math.min(index, images.length - 1)] ?? null;

  function step(delta: number) {
    if (images.length < 2) return;
    setIndex((current) => (current + delta + images.length) % images.length);
  }

  return (
    <BottomSheet
      open={Boolean(product)}
      onClose={onClose}
      title={product?.name ?? "Product"}
      subtitle={
        product
          ? `${images.length} photo${images.length === 1 ? "" : "s"} · ${
              product.stock > 0 ? `${product.stock} in stock` : "Sold out"
            }`
          : undefined
      }
    >
      {product ? (
        <>
          <div className="gallery-main">
            {active ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active} alt={`${product.name} photo ${index + 1}`} />
            ) : (
              <div className="gallery-empty">
                <Icon name="camera" size={30} />
                <span>No photos yet</span>
              </div>
            )}
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  className="gallery-nav prev"
                  onClick={() => step(-1)}
                  aria-label="Previous photo"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="gallery-nav next"
                  onClick={() => step(1)}
                  aria-label="Next photo"
                >
                  ›
                </button>
              </>
            ) : null}
            {images.length > 1 ? (
              <span className="gallery-count">
                {Math.min(index + 1, images.length)}/{images.length}
              </span>
            ) : null}
          </div>

          {images.length > 1 ? (
            <div className="gallery-strip" aria-label="Product photos">
              {images.map((url, position) => (
                <button
                  type="button"
                  key={url}
                  className={`gallery-thumb ${position === index ? "on" : ""}`}
                  onClick={() => setIndex(position)}
                  aria-label={`Show photo ${position + 1}`}
                  aria-pressed={position === index}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="gallery-details">
            {product.discount_pct ? (
              <div className="gallery-price">
                <s>
                  <MoneyText amount={product.price} className="inline-money" fit={false} />
                </s>
                <span className="tag red">-{product.discount_pct}%</span>
              </div>
            ) : null}
            <b className="gallery-price-now">
              <MoneyText amount={effectivePrice(product)} className="inline-money" fit={false} />
            </b>

            {product.description ? (
              <p className="gallery-description">{product.description}</p>
            ) : null}

            {colorNames(product.colors).length ? (
              <small className="gallery-meta">
                Colours: {colorNames(product.colors).join(", ")}
              </small>
            ) : null}
            {product.sizes?.length ? (
              <small className="gallery-meta">Sizes: {product.sizes.join(", ")}</small>
            ) : null}
          </div>
        </>
      ) : null}
    </BottomSheet>
  );
}
