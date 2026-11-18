-- ====================================================================
-- Product categories: per-vendor custom categories for products.
-- Safe to re-run.
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, name)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_vendor
  ON public.product_categories (vendor_id, name);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage product categories" ON public.product_categories;
CREATE POLICY "Vendors manage product categories" ON public.product_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = product_categories.vendor_id AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = product_categories.vendor_id AND v.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
