import type { Product } from "@/types/app-db";

export function effectivePrice(product: Pick<Product, "price" | "discount_pct">): number {
  return Math.round(product.price * (1 - (product.discount_pct || 0) / 100));
}
