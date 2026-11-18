import { Icon } from "@/components/ui/Icon";
import { productIcon } from "@/lib/product";
import { coverImageUrl } from "@/lib/product-images";
import type { Product } from "@/types/app-db";

type ThumbProduct = Pick<Product, "name" | "category"> & {
  photo_url?: string | null;
  photo_urls?: string[] | null;
};

export function Thumb({ product, className = "" }: { product: ThumbProduct; className?: string }) {
  const cover = coverImageUrl(product);
  return (
    <div className={`emo ${className}`.trim()}>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" />
      ) : (
        <Icon name={productIcon(product)} size={22} />
      )}
    </div>
  );
}
