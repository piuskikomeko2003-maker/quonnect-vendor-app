/** Products can show up to eight photos; the first photo is the cover. */
export const MAX_PRODUCT_IMAGES = 8;

type ProductImageSource = {
  photo_url?: string | null;
  photo_urls?: string[] | null;
};

/** Keeps only usable http(s)/root-relative URLs, de-duplicated and within the limit. */
export function cleanProductImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const urls: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const url = entry.trim();
    if (!url || seen.has(url)) continue;
    if (!/^(https?:\/\/|\/)/i.test(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_PRODUCT_IMAGES) break;
  }
  return urls;
}

/** Reads the gallery, falling back to the legacy single `photo_url` column. */
export function productImages(product: ProductImageSource): string[] {
  const stored = cleanProductImageUrls(product.photo_urls);
  if (stored.length) return stored;
  return cleanProductImageUrls(product.photo_url ? [product.photo_url] : []);
}

export function coverImageUrl(product: ProductImageSource): string | null {
  return productImages(product)[0] ?? null;
}

export function addProductImages(current: string[], incoming: string[]): string[] {
  return cleanProductImageUrls([...cleanProductImageUrls(current), ...cleanProductImageUrls(incoming)]);
}

export function removeProductImage(images: string[], index: number): string[] {
  return cleanProductImageUrls(images).filter((_, position) => position !== index);
}

/** Moves a photo to a new position. The first position is always the cover. */
export function moveProductImage(images: string[], from: number, to: number): string[] {
  const next = cleanProductImageUrls(images);
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) {
    return next;
  }
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function setCoverProductImage(images: string[], index: number): string[] {
  return moveProductImage(images, index, 0);
}
