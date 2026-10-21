import { CATEGORY_ICONS, type IconKey } from "@/lib/constants";
import type { Product } from "@/types/app-db";

export function effectivePrice(product: Pick<Product, "price" | "discount_pct">): number {
  return Math.round(product.price * (1 - (product.discount_pct || 0) / 100));
}

/** Category first, with a few name hints for the prototype's "Other" items. */
export function productIcon(
  product: Pick<Product, "name" | "category">,
): IconKey {
  const byCategory = CATEGORY_ICONS[product.category ?? ""];
  if (byCategory) return byCategory;
  const name = product.name.toLowerCase();
  if (name.includes("basket")) return "basket";
  if (name.includes("butter") || name.includes("bottle") || name.includes("oil")) return "bottle";
  if (name.includes("bag")) return "bag";
  return "box";
}
