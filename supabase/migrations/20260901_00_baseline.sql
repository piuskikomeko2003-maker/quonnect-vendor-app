-- ====================================================================
-- Baseline: tables that were originally created out-of-band were not in
-- the migration history. This makes a fresh `supabase db reset` work.
-- All statements are idempotent and safe against an existing project.
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  category text,
  region text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(14, 2) NOT NULL CHECK (price >= 0),
  photo_url text,
  stock integer CHECK (stock IS NULL OR stock >= 0),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_order')),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON public.products (vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_active_vendor ON public.products (is_active, vendor_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_vendor_date
  ON public.finance_entries (vendor_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_entries_vendor_type
  ON public.finance_entries (vendor_id, type);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors read own profile" ON public.vendors;
CREATE POLICY "Vendors read own profile" ON public.vendors
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Vendors insert own profile" ON public.vendors;
CREATE POLICY "Vendors insert own profile" ON public.vendors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Vendors update own profile" ON public.vendors;
CREATE POLICY "Vendors update own profile" ON public.vendors
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Vendors manage products" ON public.products;
CREATE POLICY "Vendors manage products" ON public.products
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = products.vendor_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = products.vendor_id AND v.user_id = auth.uid()));

DROP POLICY IF EXISTS "Public reads published products" ON public.products;
CREATE POLICY "Public reads published products" ON public.products
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Vendors manage finance entries" ON public.finance_entries;
CREATE POLICY "Vendors manage finance entries" ON public.finance_entries
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = finance_entries.vendor_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = finance_entries.vendor_id AND v.user_id = auth.uid()));
