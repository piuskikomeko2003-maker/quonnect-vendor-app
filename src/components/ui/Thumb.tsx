import { Icon } from "@/components/ui/Icon";
import { CATEGORY_ICONS } from "@/lib/constants";
import type { Product } from "@/types/app-db";

export function Thumb({ product, className = "" }: { product: Pick<Product, "name" | "photo_url" | "category">; className?: string }) {
  return (
    <div className={`emo ${className}`.trim()}>
      {product.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.photo_url} alt="" />
      ) : (
        <Icon name={CATEGORY_ICONS[product.category ?? ""] ?? "box"} size={22} />
      )}
    </div>
  );
}
