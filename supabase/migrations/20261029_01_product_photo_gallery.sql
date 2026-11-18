-- ====================================================================
-- Multi-photo products: store an ordered gallery per product.
-- The first URL is the cover and is mirrored into the legacy photo_url
-- column so existing thumbnails and RPCs keep working. Safe to re-run.
-- ====================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';

-- Backfill the gallery from the existing single photo.
UPDATE public.products
SET photo_urls = ARRAY[photo_url]
WHERE photo_url IS NOT NULL
  AND photo_url <> ''
  AND cardinality(photo_urls) = 0;

-- Keep the legacy cover column aligned with the gallery order.
UPDATE public.products
SET photo_url = photo_urls[1]
WHERE cardinality(photo_urls) > 0
  AND (photo_url IS NULL OR photo_url <> photo_urls[1]);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_photo_urls_max_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_photo_urls_max_check
  CHECK (cardinality(photo_urls) <= 8);

-- Any write to photo_urls updates the legacy cover automatically.
CREATE OR REPLACE FUNCTION public.sync_product_photo_cover()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.photo_urls IS NULL THEN
    NEW.photo_urls := '{}';
  END IF;

  NEW.photo_url := CASE
    WHEN cardinality(NEW.photo_urls) > 0 THEN NEW.photo_urls[1]
    ELSE NULL
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_sync_photo_cover ON public.products;
CREATE TRIGGER products_sync_photo_cover
  BEFORE INSERT OR UPDATE OF photo_urls ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.sync_product_photo_cover();

NOTIFY pgrst, 'reload schema';
