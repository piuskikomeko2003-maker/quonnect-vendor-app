-- ====================================================================
-- Quonnect Vendor - one-shot migration bundle
--
-- Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
-- Safe to re-run: all policies are dropped before recreation.
--
-- Applies, in order:
--   1. baseline tables
--   2. modular schema
--   3. stock report RPC (retired below)
--   4. UI rebuild schema, RLS, storage and aggregate RPCs
--   5. product categories
--   6. vendor month start setting
--   7. product photo gallery
--   8. business accounts and the period dashboard
--   9. business account management (create/edit, transfers, safe deactivation)
--  10. stock purchases connected to business accounts
--  11. money management (expense/income payment accounts)
--  12. usability and corrections (safe stock purchase reversal)
-- ====================================================================

-- ====================================================================
-- 1. 20260901_00_baseline.sql
-- ====================================================================

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

DROP POLICY IF EXISTS "Vendors manage finance entries" ON public.finance_entries;
CREATE POLICY "Vendors manage finance entries" ON public.finance_entries
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = finance_entries.vendor_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = finance_entries.vendor_id AND v.user_id = auth.uid()));

-- ====================================================================
-- 2. 20260928_01_core_and_modular_schema.sql
-- ====================================================================

-- ====================================================================
-- Migration: 20260928_01_core_and_modular_schema.sql
-- Description:
--   1. Add features_enabled and shop settings to public.vendors
--   2. Extend public.products with cost, units, alert thresholds, soft delete, sample flag
--   3. Extend public.finance_entries with sample flag, receipt attachment, soft delete
--   4. Create public.customers, sales, sale_items, payments with RLS
--   5. Create public.shop_suggestions for contextual feature recommendations
--   6. Create public.product_images for multi-photo support
--   7. Create Tier 2 & 3 modular tables: suppliers, purchases, purchase_items,
--      purchase_orders, damaged_items, quotations, activity_log, shop_members,
--      stores, stock_levels, stock_transfers
--   8. Create backward-compatible view `public.shops` -> `public.vendors`
--   9. Execute automatic backfill for existing vendors
-- ====================================================================

-- 1. Extend vendors (alias/acting as shops)
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS features_enabled jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'UGX',
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS signature_url text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Extend products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_service boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_stock_alert integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS quantity_unit text NOT NULL DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_vendor_deleted
  ON public.products (vendor_id, deleted_at);

-- 3. Product images
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage product images" ON public.product_images;
CREATE POLICY "Vendors manage product images"
  ON public.product_images
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = product_images.vendor_id AND v.user_id = auth.uid()
    )
  );

-- 4. Extend finance_entries
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_finance_entries_vendor_deleted
  ON public.finance_entries (vendor_id, deleted_at);

-- 5. Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  total_orders integer NOT NULL DEFAULT 0,
  total_spent numeric(14, 2) NOT NULL DEFAULT 0,
  due_amount numeric(14, 2) NOT NULL DEFAULT 0,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customers_vendor_created
  ON public.customers (vendor_id, created_at DESC);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage customers" ON public.customers;
CREATE POLICY "Vendors manage customers"
  ON public.customers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = customers.vendor_id AND v.user_id = auth.uid()
    )
  );

-- 6. Sales
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  order_no text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  discount numeric(14, 2) NOT NULL DEFAULT 0,
  tax numeric(14, 2) NOT NULL DEFAULT 0,
  shipping numeric(14, 2) NOT NULL DEFAULT 0,
  total numeric(14, 2) NOT NULL DEFAULT 0,
  paid_amount numeric(14, 2) NOT NULL DEFAULT 0,
  due_amount numeric(14, 2) NOT NULL DEFAULT 0,
  profit numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed', -- completed, partial, credit, cancelled
  payment_method text NOT NULL DEFAULT 'Cash', -- Cash, Mobile money, Bank transfer, Card, Credit
  sold_by text,
  notes text,
  sale_date date NOT NULL DEFAULT CURRENT_DATE,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sales_vendor_date
  ON public.sales (vendor_id, sale_date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_vendor_deleted
  ON public.sales (vendor_id, deleted_at);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage sales" ON public.sales;
CREATE POLICY "Vendors manage sales"
  ON public.sales
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = sales.vendor_id AND v.user_id = auth.uid()
    )
  );

-- 7. Sale Items
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price numeric(14, 2) NOT NULL DEFAULT 0,
  unit_cost numeric(14, 2) NOT NULL DEFAULT 0,
  total numeric(14, 2) NOT NULL DEFAULT 0,
  profit numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_vendor_created ON public.sale_items (vendor_id, created_at DESC);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage sale items" ON public.sale_items;
CREATE POLICY "Vendors manage sale items"
  ON public.sale_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = sale_items.vendor_id AND v.user_id = auth.uid()
    )
  );

-- 8. Payments (Multi-payment & installment tracking)
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  amount numeric(14, 2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Cash',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  is_sample boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_vendor_sale ON public.payments (vendor_id, sale_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage payments" ON public.payments;
CREATE POLICY "Vendors manage payments"
  ON public.payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = payments.vendor_id AND v.user_id = auth.uid()
    )
  );

-- 9. Shop Suggestions (Contextual reveal engine)
CREATE TABLE IF NOT EXISTS public.shop_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending, dismissed, enabled, snoozed
  snoozed_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_shop_suggestions_vendor ON public.shop_suggestions (vendor_id, status);

ALTER TABLE public.shop_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage suggestions" ON public.shop_suggestions;
CREATE POLICY "Vendors manage suggestions"
  ON public.shop_suggestions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = shop_suggestions.vendor_id AND v.user_id = auth.uid()
    )
  );

-- 10. Tier 2: Suppliers, Purchases, Purchase Orders
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage suppliers" ON public.suppliers;
CREATE POLICY "Vendors manage suppliers" ON public.suppliers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = suppliers.vendor_id AND v.user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  reference_no text,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric(14, 2) NOT NULL DEFAULT 0,
  paid_amount numeric(14, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage purchases" ON public.purchases;
CREATE POLICY "Vendors manage purchases" ON public.purchases FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = purchases.vendor_id AND v.user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  unit_cost numeric(14, 2) NOT NULL DEFAULT 0,
  total_cost numeric(14, 2) NOT NULL DEFAULT 0,
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage purchase items" ON public.purchase_items;
CREATE POLICY "Vendors manage purchase items" ON public.purchase_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = purchase_items.vendor_id AND v.user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, sent, confirmed, received, cancelled
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_date date,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric(14, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage purchase orders" ON public.purchase_orders;
CREATE POLICY "Vendors manage purchase orders" ON public.purchase_orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = purchase_orders.vendor_id AND v.user_id = auth.uid())
);

-- 11. Tier 2: Damaged Items (Stock loss log)
CREATE TABLE IF NOT EXISTS public.damaged_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  estimated_loss numeric(14, 2) NOT NULL DEFAULT 0,
  reason text NOT NULL, -- Damaged/Broken, Expired/Spoiled, Lost/Missing, Stolen, Sample/Giveaway
  loss_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.damaged_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage damaged items" ON public.damaged_items;
CREATE POLICY "Vendors manage damaged items" ON public.damaged_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = damaged_items.vendor_id AND v.user_id = auth.uid())
);

-- 12. Tier 2: Quotations
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  quotation_no text NOT NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  quote_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  discount numeric(14, 2) NOT NULL DEFAULT 0,
  tax numeric(14, 2) NOT NULL DEFAULT 0,
  shipping numeric(14, 2) NOT NULL DEFAULT 0,
  total numeric(14, 2) NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'open', -- open, accepted, converted, rejected, expired
  converted_sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage quotations" ON public.quotations;
CREATE POLICY "Vendors manage quotations" ON public.quotations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = quotations.vendor_id AND v.user_id = auth.uid())
);

-- 13. Tier 2: Activity Log
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  action text NOT NULL, -- create, update, delete, status_change
  entity_type text NOT NULL, -- sale, product, customer, expense, stock
  entity_id text,
  description text NOT NULL,
  performed_by text NOT NULL DEFAULT 'Owner',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_vendor ON public.activity_log (vendor_id, created_at DESC);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage activity log" ON public.activity_log;
CREATE POLICY "Vendors manage activity log" ON public.activity_log FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = activity_log.vendor_id AND v.user_id = auth.uid())
);

-- 14. Tier 3: Shop Members / Representatives
CREATE TABLE IF NOT EXISTS public.shop_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id uuid, -- linked once invited user signs in or creates auth account
  username text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'cashier', -- cashier, manager, custom
  permissions jsonb NOT NULL DEFAULT '{
    "customers": "view",
    "products": "view",
    "sales": "edit",
    "expense": "none",
    "income": "none",
    "can_see_report": false,
    "can_see_profit": false,
    "can_see_cost": false,
    "can_edit_price": false,
    "can_see_other_sales": false,
    "can_see_stock_cost": false
  }'::jsonb,
  commission_type text NOT NULL DEFAULT 'percent', -- percent, flat
  commission_rate numeric(8, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage shop members" ON public.shop_members;
CREATE POLICY "Vendors manage shop members" ON public.shop_members FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = shop_members.vendor_id AND v.user_id = auth.uid())
);

-- 15. Tier 3: Multi-store & Branches
CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  phone text,
  is_main boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage stores" ON public.stores;
CREATE POLICY "Vendors manage stores" ON public.stores FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = stores.vendor_id AND v.user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.stock_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity numeric(10, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, product_id)
);

ALTER TABLE public.stock_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage stock levels" ON public.stock_levels;
CREATE POLICY "Vendors manage stock levels" ON public.stock_levels FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = stock_levels.vendor_id AND v.user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  from_store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  to_store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric(10, 2) NOT NULL DEFAULT 1,
  transfer_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  transferred_by text NOT NULL DEFAULT 'Owner'
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Vendors manage stock transfers" ON public.stock_transfers;
CREATE POLICY "Vendors manage stock transfers" ON public.stock_transfers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = stock_transfers.vendor_id AND v.user_id = auth.uid())
);

-- ====================================================================
-- 16. Automatic Backfill for Existing Vendors (Section 4)
-- ====================================================================
DO $$
DECLARE
  v_record RECORD;
  v_has_expense boolean;
  v_has_income boolean;
  v_has_members boolean;
  v_flags jsonb;
BEGIN
  FOR v_record IN SELECT id, features_enabled FROM public.vendors LOOP
    v_flags := COALESCE(v_record.features_enabled, '{}'::jsonb);

    -- Check if vendor has existing expense records in finance_entries
    SELECT EXISTS (
      SELECT 1 FROM public.finance_entries
      WHERE vendor_id = v_record.id AND type = 'expense'
    ) INTO v_has_expense;

    -- Check if vendor has existing income records in finance_entries
    SELECT EXISTS (
      SELECT 1 FROM public.finance_entries
      WHERE vendor_id = v_record.id AND type = 'income'
    ) INTO v_has_income;

    IF v_has_expense THEN
      v_flags := jsonb_set(v_flags, '{expense}', 'true'::jsonb, true);
    END IF;

    IF v_has_income THEN
      v_flags := jsonb_set(v_flags, '{income}', 'true'::jsonb, true);
    END IF;

    UPDATE public.vendors
    SET features_enabled = v_flags
    WHERE id = v_record.id;
  END LOOP;
END $$;

-- ====================================================================
-- 3. 20260928_02_report_stock_rpc.sql
-- ====================================================================

-- ====================================================================
-- Migration: 20260928_02_report_stock_rpc.sql
-- Description: Postgres RPC report_stock returning KPIs and tables A & B
-- ====================================================================

CREATE OR REPLACE FUNCTION public.report_stock(
  p_vendor_id uuid,
  p_from date,
  p_to date,
  p_category text DEFAULT NULL,
  p_exclude_zero boolean DEFAULT false,
  p_viewer_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_owner boolean := false;
  v_can_see_profit boolean := false;
  v_can_see_cost boolean := false;
  v_stock_cost numeric := 0;
  v_expected_sale_value numeric := 0;
  v_sell_profit numeric := 0;
  v_total_stock numeric := 0;
  v_sold_stock_value numeric := 0;
  v_kpis jsonb;
  v_table_a jsonb;
  v_table_b jsonb;
  v_has_sample boolean := false;
BEGIN
  -- 1. Check permissions
  -- If p_viewer_user_id matches the owner in public.vendors, grant full access
  SELECT EXISTS (
    SELECT 1 FROM public.vendors
    WHERE id = p_vendor_id AND user_id = p_viewer_user_id
  ) INTO v_is_owner;

  IF v_is_owner OR p_viewer_user_id IS NULL THEN
    v_can_see_profit := true;
    v_can_see_cost := true;
  ELSE
    -- Check shop_members
    SELECT 
      COALESCE((permissions->>'can_see_profit')::boolean, false),
      COALESCE((permissions->>'can_see_cost')::boolean, false)
    INTO v_can_see_profit, v_can_see_cost
    FROM public.shop_members
    WHERE vendor_id = p_vendor_id AND user_id = p_viewer_user_id AND is_active = true
    LIMIT 1;
  END IF;

  -- 2. Check if sample data exists in physical products
  SELECT EXISTS (
    SELECT 1 FROM public.products
    WHERE vendor_id = p_vendor_id AND is_sample = true AND is_service = false AND deleted_at IS NULL
  ) INTO v_has_sample;

  -- 3. Calculate Global Inventory KPIs for active physical products
  SELECT 
    COALESCE(SUM(GREATEST(0, stock) * cost), 0),
    COALESCE(SUM(GREATEST(0, stock) * price), 0),
    COALESCE(SUM(GREATEST(0, stock) * (price - cost)), 0),
    COALESCE(SUM(GREATEST(0, stock)), 0)
  INTO 
    v_stock_cost,
    v_expected_sale_value,
    v_sell_profit,
    v_total_stock
  FROM public.products
  WHERE vendor_id = p_vendor_id 
    AND is_service = false 
    AND deleted_at IS NULL
    AND (p_category IS NULL OR p_category = '' OR category = p_category)
    AND (NOT p_exclude_zero OR (stock IS NOT NULL AND stock > 0));

  -- Assemble KPI jsonb (respecting permission rules)
  v_kpis := jsonb_build_object(
    'total_stock', v_total_stock,
    'expected_sale_value', v_expected_sale_value,
    'stock_cost', CASE WHEN v_can_see_cost THEN to_jsonb(v_stock_cost) ELSE 'null'::jsonb END,
    'sell_profit', CASE WHEN v_can_see_profit THEN to_jsonb(v_sell_profit) ELSE 'null'::jsonb END,
    'can_see_cost', v_can_see_cost,
    'can_see_profit', v_can_see_profit,
    'has_sample', v_has_sample
  );

  -- 4. Table A: Products sold during the period
  WITH period_sales AS (
    SELECT 
      si.product_id,
      SUM(si.quantity) as sold_qty,
      SUM(si.total) as sold_revenue,
      SUM(si.profit) as sold_profit
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.vendor_id = p_vendor_id
      AND s.sale_date >= p_from
      AND s.sale_date <= p_to
      AND s.deleted_at IS NULL
    GROUP BY si.product_id
  )
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'sku', p.sku,
          'photo_url', p.photo_url,
          'price', p.price,
          'cost', CASE WHEN v_can_see_cost THEN to_jsonb(p.cost) ELSE 'null'::jsonb END,
          'stock', p.stock,
          'quantity_unit', p.quantity_unit,
          'min_stock_alert', p.min_stock_alert,
          'is_sample', p.is_sample,
          'sold_qty', ps.sold_qty,
          'sold_revenue', ps.sold_revenue,
          'sold_profit', CASE WHEN v_can_see_profit THEN to_jsonb(ps.sold_profit) ELSE 'null'::jsonb END
        )
        ORDER BY ps.sold_qty DESC
      ),
      '[]'::jsonb
    ),
    COALESCE(SUM(ps.sold_revenue), 0)
  INTO v_table_a, v_sold_stock_value
  FROM period_sales ps
  JOIN public.products p ON p.id = ps.product_id
  WHERE p.vendor_id = p_vendor_id
    AND p.is_service = false
    AND p.deleted_at IS NULL
    AND (p_category IS NULL OR p_category = '' OR p.category = p_category)
    AND (NOT p_exclude_zero OR (p.stock IS NOT NULL AND p.stock > 0));

  -- 5. Table B: Current Inventory (with Sold column in period)
  WITH period_product_sales AS (
    SELECT 
      si.product_id,
      COALESCE(SUM(si.quantity), 0) as sold_qty
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.vendor_id = p_vendor_id
      AND s.sale_date >= p_from
      AND s.sale_date <= p_to
      AND s.deleted_at IS NULL
    GROUP BY si.product_id
  )
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'sku', p.sku,
          'photo_url', p.photo_url,
          'price', p.price,
          'cost', CASE WHEN v_can_see_cost THEN to_jsonb(p.cost) ELSE 'null'::jsonb END,
          'stock', p.stock,
          'quantity_unit', p.quantity_unit,
          'min_stock_alert', p.min_stock_alert,
          'is_sample', p.is_sample,
          'sold_qty', COALESCE(pps.sold_qty, 0),
          'stock_value', GREATEST(0, p.stock) * p.price,
          'stock_cost_value', CASE WHEN v_can_see_cost THEN to_jsonb(GREATEST(0, p.stock) * p.cost) ELSE 'null'::jsonb END
        )
        ORDER BY p.name ASC
      ),
      '[]'::jsonb
    )
  INTO v_table_b
  FROM public.products p
  LEFT JOIN period_product_sales pps ON pps.product_id = p.id
  WHERE p.vendor_id = p_vendor_id
    AND p.is_service = false
    AND p.deleted_at IS NULL
    AND (p_category IS NULL OR p_category = '' OR p.category = p_category)
    AND (NOT p_exclude_zero OR (p.stock IS NOT NULL AND p.stock > 0));

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'table_a', v_table_a,
    'table_b', v_table_b,
    'sold_stock_value', v_sold_stock_value
  );
END;
$$;

-- ====================================================================
-- 4. 20261021_01_ui_rebuild.sql
-- ====================================================================

-- ====================================================================
-- UI rebuild: profile fields, stalls, stock movements, budgets,
-- sale price snapshots, RLS, storage and aggregate RPCs.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Profile and product fields
-- --------------------------------------------------------------------
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS phone2 text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS motto text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS facebook text,
  ADD COLUMN IF NOT EXISTS tiktok text,
  ADD COLUMN IF NOT EXISTS whatsapp text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sizes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS colors text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discount_pct integer NOT NULL DEFAULT 0;

UPDATE public.products SET stock = 0 WHERE stock IS NULL;
ALTER TABLE public.products ALTER COLUMN stock SET DEFAULT 0;
ALTER TABLE public.products ALTER COLUMN stock SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_discount_pct_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_discount_pct_check CHECK (discount_pct BETWEEN 0 AND 90);
  END IF;
END $$;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS price_reduction numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS listed_price numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sold_price numeric(14, 2) NOT NULL DEFAULT 0;

UPDATE public.sale_items
SET listed_price = unit_price, sold_price = unit_price
WHERE sold_price = 0;

-- --------------------------------------------------------------------
-- 2. Stalls
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL UNIQUE REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  accent_color text NOT NULL DEFAULT '#0F8A4D',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.stalls (vendor_id, name, tagline)
SELECT v.id, v.business_name, COALESCE(v.motto, '')
FROM public.vendors v
ON CONFLICT (vendor_id) DO NOTHING;

-- --------------------------------------------------------------------
-- 3. Stock movements
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('sale', 'restock', 'adjustment')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_vendor_created
  ON public.stock_movements (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product
  ON public.stock_movements (product_id, created_at DESC);

-- --------------------------------------------------------------------
-- 4. Budgets
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  category text NOT NULL,
  monthly_limit numeric(14, 2) NOT NULL CHECK (monthly_limit >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, category)
);

-- --------------------------------------------------------------------
-- 5. RLS
-- --------------------------------------------------------------------
ALTER TABLE public.stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage stalls" ON public.stalls;
CREATE POLICY "Vendors manage stalls" ON public.stalls
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = stalls.vendor_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = stalls.vendor_id AND v.user_id = auth.uid()));

DROP POLICY IF EXISTS "Vendors manage stock movements" ON public.stock_movements;
CREATE POLICY "Vendors manage stock movements" ON public.stock_movements
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = stock_movements.vendor_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = stock_movements.vendor_id AND v.user_id = auth.uid()));

DROP POLICY IF EXISTS "Vendors manage budgets" ON public.budgets;
CREATE POLICY "Vendors manage budgets" ON public.budgets
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = budgets.vendor_id AND v.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = budgets.vendor_id AND v.user_id = auth.uid()));

-- The customer preview is rendered from the owner's session, not from a
-- public marketplace query. Keep products strictly vendor-scoped.
DROP POLICY IF EXISTS "Public reads published products" ON public.products;
DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
DROP POLICY IF EXISTS "Public read active products" ON public.products;

-- Remove any other legacy public SELECT policy on products. The customer
-- preview uses the owner's authenticated session, not an anonymous query.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.products', policy_row.policyname);
  END LOOP;
END $$;

-- --------------------------------------------------------------------
-- 6. Stalls for every vendor + updated_at helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_stall_for_vendor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.stalls (vendor_id, name, tagline)
  VALUES (NEW.id, NEW.business_name, COALESCE(NEW.motto, ''))
  ON CONFLICT (vendor_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_stall_for_vendor ON public.vendors;
CREATE TRIGGER create_stall_for_vendor
  AFTER INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.create_stall_for_vendor();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_set_updated_at ON public.vendors;
CREATE TRIGGER vendors_set_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS stalls_set_updated_at ON public.stalls;
CREATE TRIGGER stalls_set_updated_at
  BEFORE UPDATE ON public.stalls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS products_set_updated_at ON public.products;
CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Signup trigger: populate the full vendor profile from auth metadata.
CREATE OR REPLACE FUNCTION public.handle_new_vendor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  INSERT INTO public.vendors (
    user_id, owner_name, business_name, category, region, phone, email,
    motto, instagram, facebook, tiktok, whatsapp, logo_url
  )
  VALUES (
    NEW.id,
    meta->>'owner_name',
    COALESCE(meta->>'business_name', 'My Stall'),
    meta->>'category',
    meta->>'region',
    meta->>'phone',
    NEW.email,
    meta->>'motto',
    meta->>'instagram',
    meta->>'facebook',
    meta->>'tiktok',
    meta->>'whatsapp',
    meta->>'logo_url'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_vendor ON auth.users;
CREATE TRIGGER on_auth_user_created_vendor
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_vendor();

-- Initial stock is recorded as an adjustment movement.
CREATE OR REPLACE FUNCTION public.record_initial_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.stock IS NOT NULL AND NEW.stock > 0 THEN
    INSERT INTO public.stock_movements (vendor_id, product_id, delta, reason)
    VALUES (NEW.vendor_id, NEW.id, NEW.stock, 'adjustment');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_initial_stock ON public.products;
CREATE TRIGGER record_initial_stock
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.record_initial_stock();

-- --------------------------------------------------------------------
-- 7. Storage bucket and policies
-- --------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-assets', 'vendor-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read vendor assets" ON storage.objects;
CREATE POLICY "Public read vendor assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'vendor-assets');

DROP POLICY IF EXISTS "Vendors upload vendor assets" ON storage.objects;
CREATE POLICY "Vendors upload vendor assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.user_id = auth.uid() AND v.id::text = (storage.foldername(name))[1]
      )
    )
  );

DROP POLICY IF EXISTS "Vendors update vendor assets" ON storage.objects;
CREATE POLICY "Vendors update vendor assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.user_id = auth.uid() AND v.id::text = (storage.foldername(name))[1]
      )
    )
  );

DROP POLICY IF EXISTS "Vendors delete vendor assets" ON storage.objects;
CREATE POLICY "Vendors delete vendor assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.user_id = auth.uid() AND v.id::text = (storage.foldername(name))[1]
      )
    )
  );

-- Retire the legacy stock report RPC. It treated a NULL viewer id as the
-- owner, which would let any authenticated caller read another vendor's stock.
DROP FUNCTION IF EXISTS public.report_stock(uuid, date, date, text, boolean, uuid);

-- --------------------------------------------------------------------
-- 8. Transactional RPCs
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_vendor_owner(p_vendor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.vendors WHERE id = p_vendor_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You do not have access to this vendor' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_sale(
  p_vendor_id uuid,
  p_items jsonb,
  p_payment_method text DEFAULT 'Cash',
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale_id uuid;
  v_order_no text;
  v_total numeric := 0;
  v_profit numeric := 0;
  v_reduction numeric := 0;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_qty integer;
  v_listed numeric;
  v_sold numeric;
  v_cost numeric;
  v_today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  v_order_no := 'S-' || to_char(v_today, 'YYMMDD') || '-' ||
    lpad((floor(random() * 9000) + 1000)::text, 4, '0');

  INSERT INTO public.sales (
    vendor_id, order_no, customer_name, customer_phone, payment_method,
    sale_date, status, total, subtotal, paid_amount
  )
  VALUES (
    p_vendor_id, v_order_no, NULLIF(p_customer_name, ''), NULLIF(p_customer_phone, ''),
    COALESCE(NULLIF(p_payment_method, ''), 'Cash'), v_today, 'completed', 0, 0, 0
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := GREATEST(1, COALESCE((v_item->>'qty')::integer, 1));

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid
      AND vendor_id = p_vendor_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found on your stall';
    END IF;

    IF COALESCE(v_product.stock, 0) < v_qty THEN
      RAISE EXCEPTION 'Not enough stock for %', v_product.name;
    END IF;

    v_listed := ROUND(v_product.price * (1 - COALESCE(v_product.discount_pct, 0) / 100.0), 2);
    v_sold := COALESCE((v_item->>'sold_price')::numeric, v_listed);
    v_cost := COALESCE(v_product.cost, 0);

    IF v_sold < 0 THEN
      RAISE EXCEPTION 'Selling price cannot be negative';
    END IF;

    v_total := v_total + (v_sold * v_qty);
    v_profit := v_profit + ((v_sold - v_cost) * v_qty);
    v_reduction := v_reduction + ((v_listed - v_sold) * v_qty);

    UPDATE public.products
    SET stock = stock - v_qty
    WHERE id = v_product.id;

    INSERT INTO public.stock_movements (vendor_id, product_id, delta, reason)
    VALUES (p_vendor_id, v_product.id, -v_qty, 'sale');

    INSERT INTO public.sale_items (
      sale_id, vendor_id, product_id, product_name, quantity,
      unit_price, unit_cost, listed_price, sold_price, total, profit
    )
    VALUES (
      v_sale_id, p_vendor_id, v_product.id, v_product.name, v_qty,
      v_sold, v_cost, v_listed, v_sold, v_sold * v_qty, (v_sold - v_cost) * v_qty
    );
  END LOOP;

  UPDATE public.sales
  SET total = v_total,
      subtotal = v_total,
      paid_amount = v_total,
      profit = v_profit,
      price_reduction = v_reduction
  WHERE id = v_sale_id;

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'order_no', v_order_no,
    'total', v_total,
    'profit', v_profit,
    'price_reduction', v_reduction
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.restock_product(
  p_vendor_id uuid,
  p_product_id uuid,
  p_qty integer,
  p_new_cost numeric DEFAULT NULL,
  p_create_expense boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_cost numeric;
  v_today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  IF p_qty IS NULL OR p_qty < 1 THEN
    RAISE EXCEPTION 'Enter a quantity';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found on your stall';
  END IF;

  v_cost := COALESCE(p_new_cost, v_product.cost, 0);

  UPDATE public.products
  SET stock = COALESCE(stock, 0) + p_qty,
      cost = v_cost
  WHERE id = p_product_id;

  INSERT INTO public.stock_movements (vendor_id, product_id, delta, reason)
  VALUES (p_vendor_id, p_product_id, p_qty, 'restock');

  IF p_create_expense THEN
    INSERT INTO public.finance_entries (
      vendor_id, type, category, amount, source, entry_date, notes
    )
    VALUES (
      p_vendor_id, 'expense', 'Stock purchase', p_qty * v_cost, 'manual', v_today,
      'Restock: ' || v_product.name
    );
  END IF;

  RETURN jsonb_build_object(
    'stock', COALESCE(v_product.stock, 0) + p_qty,
    'cost', v_cost
  );
END;
$$;

-- --------------------------------------------------------------------
-- 9. Aggregate RPCs (no row loading in the browser)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_daily_series(
  p_vendor_id uuid,
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  WITH days AS (
    SELECT generate_series(p_from, p_to, interval '1 day')::date AS day
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'day', d.day,
        'sales', COALESCE(s.total, 0),
        'gross_profit', COALESCE(s.profit, 0),
        'price_reduction', COALESCE(s.reduction, 0),
        'expected_revenue', COALESCE(s.total, 0) + COALESCE(s.reduction, 0),
        'expenses', COALESCE(e.total, 0),
        'operating_expenses', COALESCE(e.operating, 0),
        'other_income', COALESCE(i.total, 0),
        'net_profit', COALESCE(s.profit, 0) + COALESCE(i.total, 0) - COALESCE(e.operating, 0)
      ) ORDER BY d.day
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM days d
  LEFT JOIN LATERAL (
    SELECT SUM(total) AS total, SUM(profit) AS profit, SUM(price_reduction) AS reduction
    FROM public.sales
    WHERE vendor_id = p_vendor_id AND sale_date = d.day AND deleted_at IS NULL
  ) s ON true
  LEFT JOIN LATERAL (
    SELECT SUM(amount) AS total,
           SUM(amount) FILTER (WHERE category <> 'Stock purchase') AS operating
    FROM public.finance_entries
    WHERE vendor_id = p_vendor_id AND type = 'expense' AND entry_date = d.day
  ) e ON true
  LEFT JOIN LATERAL (
    SELECT SUM(amount) AS total
    FROM public.finance_entries
    WHERE vendor_id = p_vendor_id AND type = 'income' AND entry_date = d.day
  ) i ON true;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_monthly_series(
  p_vendor_id uuid,
  p_months integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_months integer := GREATEST(1, LEAST(24, COALESCE(p_months, 12)));
  v_current date := date_trunc('month', (now() AT TIME ZONE 'Africa/Kampala')::date)::date;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  WITH months AS (
    SELECT generate_series(
      v_current - make_interval(months => v_months - 1),
      v_current,
      interval '1 month'
    )::date AS month
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'month', to_char(m.month, 'YYYY-MM'),
        'sales', COALESCE(s.total, 0),
        'gross_profit', COALESCE(s.profit, 0),
        'cogs', COALESCE(s.total, 0) - COALESCE(s.profit, 0),
        'expected_revenue', COALESCE(s.total, 0) + COALESCE(s.reduction, 0),
        'expenses', COALESCE(e.total, 0),
        'operating_expenses', COALESCE(e.operating, 0),
        'other_income', COALESCE(i.total, 0),
        'net_profit', COALESCE(s.profit, 0) + COALESCE(i.total, 0) - COALESCE(e.operating, 0)
      ) ORDER BY m.month
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM months m
  LEFT JOIN LATERAL (
    SELECT SUM(total) AS total, SUM(profit) AS profit, SUM(price_reduction) AS reduction
    FROM public.sales
    WHERE vendor_id = p_vendor_id
      AND sale_date >= m.month
      AND sale_date < m.month + interval '1 month'
      AND deleted_at IS NULL
  ) s ON true
  LEFT JOIN LATERAL (
    SELECT SUM(amount) AS total,
           SUM(amount) FILTER (WHERE category <> 'Stock purchase') AS operating
    FROM public.finance_entries
    WHERE vendor_id = p_vendor_id
      AND type = 'expense'
      AND entry_date >= m.month
      AND entry_date < m.month + interval '1 month'
  ) e ON true
  LEFT JOIN LATERAL (
    SELECT SUM(amount) AS total
    FROM public.finance_entries
    WHERE vendor_id = p_vendor_id
      AND type = 'income'
      AND entry_date >= m.month
      AND entry_date < m.month + interval '1 month'
  ) i ON true;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_expense_categories(
  p_vendor_id uuid,
  p_from date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('category', category, 'total', total)
      ORDER BY total DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT category, SUM(amount) AS total
    FROM public.finance_entries
    WHERE vendor_id = p_vendor_id
      AND type = 'expense'
      AND entry_date >= p_from
    GROUP BY category
  ) rows;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_item_stats(p_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  WITH sold AS (
    SELECT
      si.product_name AS name,
      SUM(si.quantity) AS qty,
      SUM(si.sold_price * si.quantity) AS sold_total,
      SUM(si.listed_price * si.quantity) AS listed_total,
      SUM(si.unit_cost * si.quantity) AS cost_total
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.vendor_id = p_vendor_id AND s.deleted_at IS NULL
    GROUP BY si.product_name
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', rows.name,
        'cost', rows.cost,
        'expected', rows.expected,
        'actual', rows.actual,
        'sold', rows.qty
      ) ORDER BY rows.qty DESC, rows.name
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT
      p.name,
      COALESCE(sd.qty, 0) AS qty,
      CASE WHEN COALESCE(sd.qty, 0) > 0 THEN sd.cost_total / sd.qty ELSE p.cost END AS cost,
      CASE WHEN COALESCE(sd.qty, 0) > 0
        THEN sd.listed_total / sd.qty
        ELSE p.price * (1 - COALESCE(p.discount_pct, 0) / 100.0)
      END AS expected,
      CASE WHEN COALESCE(sd.qty, 0) > 0 THEN sd.sold_total / sd.qty ELSE 0 END AS actual
    FROM public.products p
    LEFT JOIN sold sd ON sd.name = p.name
    WHERE p.vendor_id = p_vendor_id AND p.deleted_at IS NULL
    ORDER BY COALESCE(sd.qty, 0) DESC, p.name
    LIMIT 8
  ) rows;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_recent_transactions(
  p_vendor_id uuid,
  p_limit integer DEFAULT 40
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_limit integer := GREATEST(1, LEAST(100, COALESCE(p_limit, 40)));
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'kind', kind,
        'title', title,
        'category', category,
        'amount', amount,
        'date', entry_date,
        'ts', created_at,
        'items', items
      ) ORDER BY entry_date DESC, created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT * FROM (
      SELECT
        s.id,
        'sale'::text AS kind,
        'Sales'::text AS title,
        'Sales'::text AS category,
        s.total AS amount,
        s.sale_date AS entry_date,
        s.created_at,
        (
          SELECT jsonb_agg(product_name)
          FROM (
            SELECT product_name FROM public.sale_items WHERE sale_id = s.id LIMIT 2
          ) names
        ) AS items
      FROM public.sales s
      WHERE s.vendor_id = p_vendor_id AND s.deleted_at IS NULL

      UNION ALL

      SELECT
        f.id,
        'expense'::text,
        COALESCE(NULLIF(f.notes, ''), f.category),
        f.category,
        -f.amount,
        f.entry_date,
        f.created_at,
        NULL::jsonb
      FROM public.finance_entries f
      WHERE f.vendor_id = p_vendor_id AND f.type = 'expense'

      UNION ALL

      SELECT
        f.id,
        'income'::text,
        f.category,
        'Other Income'::text,
        f.amount,
        f.entry_date,
        f.created_at,
        NULL::jsonb
      FROM public.finance_entries f
      WHERE f.vendor_id = p_vendor_id AND f.type = 'income'
    ) all_rows
    ORDER BY entry_date DESC, created_at DESC
    LIMIT v_limit
  ) rows;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.vendor_home_overview(
  p_vendor_id uuid,
  p_month text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  v_yesterday date := v_today - 1;
  v_current_month date := date_trunc('month', v_today)::date;
  v_month_start date;
  v_month_end date;
  v_prev_month_start date;
  v_prev_month_end date;
  v_dom integer;
  v_sales_today numeric := 0;
  v_sales_yesterday numeric := 0;
  v_net_today numeric := 0;
  v_net_yesterday numeric := 0;
  v_expenses_today numeric := 0;
  v_expenses_yesterday numeric := 0;
  v_net_month numeric := 0;
  v_net_prev numeric := 0;
  v_sales numeric := 0;
  v_gross numeric := 0;
  v_reduction numeric := 0;
  v_income numeric := 0;
  v_expenses numeric := 0;
  v_budget_spent numeric := 0;
  v_budget_total numeric := 0;
  v_low_stock jsonb := '[]'::jsonb;
  v_selected text := COALESCE(NULLIF(p_month, ''), to_char(v_today, 'YYYY-MM'));
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  v_month_start := (v_selected || '-01')::date;
  v_month_end := (v_month_start + interval '1 month')::date;

  SELECT COALESCE(SUM(total), 0) INTO v_sales_today
  FROM public.sales WHERE vendor_id = p_vendor_id AND sale_date = v_today AND deleted_at IS NULL;

  SELECT COALESCE(SUM(total), 0) INTO v_sales_yesterday
  FROM public.sales WHERE vendor_id = p_vendor_id AND sale_date = v_yesterday AND deleted_at IS NULL;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses_today
  FROM public.finance_entries WHERE vendor_id = p_vendor_id AND type = 'expense' AND entry_date = v_today;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses_yesterday
  FROM public.finance_entries WHERE vendor_id = p_vendor_id AND type = 'expense' AND entry_date = v_yesterday;

  SELECT
    COALESCE((SELECT SUM(profit) FROM public.sales WHERE vendor_id = p_vendor_id AND sale_date = v_today AND deleted_at IS NULL), 0)
    + COALESCE((SELECT SUM(amount) FROM public.finance_entries WHERE vendor_id = p_vendor_id AND type = 'income' AND entry_date = v_today), 0)
    - COALESCE((SELECT SUM(amount) FROM public.finance_entries WHERE vendor_id = p_vendor_id AND type = 'expense' AND category <> 'Stock purchase' AND entry_date = v_today), 0)
  INTO v_net_today;

  SELECT
    COALESCE((SELECT SUM(profit) FROM public.sales WHERE vendor_id = p_vendor_id AND sale_date = v_yesterday AND deleted_at IS NULL), 0)
    + COALESCE((SELECT SUM(amount) FROM public.finance_entries WHERE vendor_id = p_vendor_id AND type = 'income' AND entry_date = v_yesterday), 0)
    - COALESCE((SELECT SUM(amount) FROM public.finance_entries WHERE vendor_id = p_vendor_id AND type = 'expense' AND category <> 'Stock purchase' AND entry_date = v_yesterday), 0)
  INTO v_net_yesterday;

  SELECT COALESCE(SUM(total), 0) INTO v_sales
  FROM public.sales
  WHERE vendor_id = p_vendor_id AND sale_date >= v_month_start AND sale_date < v_month_end AND deleted_at IS NULL;

  SELECT COALESCE(SUM(profit), 0) INTO v_gross
  FROM public.sales
  WHERE vendor_id = p_vendor_id AND sale_date >= v_month_start AND sale_date < v_month_end AND deleted_at IS NULL;

  SELECT COALESCE(SUM(GREATEST(price_reduction, 0)), 0) INTO v_reduction
  FROM public.sales
  WHERE vendor_id = p_vendor_id AND sale_date >= v_month_start AND sale_date < v_month_end AND deleted_at IS NULL;

  SELECT COALESCE(SUM(amount), 0) INTO v_income
  FROM public.finance_entries
  WHERE vendor_id = p_vendor_id AND type = 'income'
    AND entry_date >= v_month_start AND entry_date < v_month_end;

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.finance_entries
  WHERE vendor_id = p_vendor_id AND type = 'expense'
    AND entry_date >= v_month_start AND entry_date < v_month_end;

  SELECT COALESCE(SUM(amount), 0) INTO v_net_month
  FROM public.finance_entries
  WHERE vendor_id = p_vendor_id AND type = 'expense' AND category <> 'Stock purchase'
    AND entry_date >= v_month_start AND entry_date < v_month_end;

  v_net_month := v_gross + v_income - v_net_month;

  v_dom := EXTRACT(DAY FROM v_today)::integer;
  v_prev_month_start := (v_current_month - interval '1 month')::date;
  v_prev_month_end := LEAST(
    v_prev_month_start + (v_dom - 1),
    (v_prev_month_start + interval '1 month - 1 day')::date
  );

  SELECT COALESCE(SUM(profit), 0) INTO v_net_prev
  FROM public.sales
  WHERE vendor_id = p_vendor_id AND sale_date >= v_prev_month_start AND sale_date <= v_prev_month_end AND deleted_at IS NULL;

  v_net_prev := v_net_prev
    + COALESCE((
        SELECT SUM(amount) FROM public.finance_entries
        WHERE vendor_id = p_vendor_id AND type = 'income'
          AND entry_date >= v_prev_month_start AND entry_date <= v_prev_month_end
      ), 0)
    - COALESCE((
        SELECT SUM(amount) FROM public.finance_entries
        WHERE vendor_id = p_vendor_id AND type = 'expense' AND category <> 'Stock purchase'
          AND entry_date >= v_prev_month_start AND entry_date <= v_prev_month_end
      ), 0);

  SELECT COALESCE(SUM(f.amount), 0) INTO v_budget_spent
  FROM public.finance_entries f
  JOIN public.budgets b ON b.vendor_id = f.vendor_id AND b.category = f.category
  WHERE f.vendor_id = p_vendor_id AND f.type = 'expense'
    AND f.entry_date >= v_current_month AND f.entry_date < v_current_month + interval '1 month';

  SELECT COALESCE(SUM(monthly_limit), 0) INTO v_budget_total
  FROM public.budgets WHERE vendor_id = p_vendor_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'stock', p.stock,
        'category', p.category,
        'photo_url', p.photo_url,
        'price', p.price,
        'cost', p.cost,
        'discount_pct', p.discount_pct
      ) ORDER BY p.stock ASC, p.name
    ),
    '[]'::jsonb
  )
  INTO v_low_stock
  FROM (
    SELECT * FROM public.products
    WHERE vendor_id = p_vendor_id AND deleted_at IS NULL AND stock <= 3
    ORDER BY stock ASC, name
    LIMIT 12
  ) p;

  RETURN jsonb_build_object(
    'today', v_today,
    'selected_month', v_selected,
    'sales_today', v_sales_today,
    'sales_yesterday', v_sales_yesterday,
    'net_today', v_net_today,
    'net_yesterday', v_net_yesterday,
    'expenses_today', v_expenses_today,
    'expenses_yesterday', v_expenses_yesterday,
    'net_month', v_net_month,
    'net_prev_month', v_net_prev,
    'month', jsonb_build_object(
      'sales', v_sales,
      'gross_profit', v_gross,
      'price_reduction', v_reduction,
      'other_income', v_income,
      'expenses', v_expenses,
      'net_profit', v_net_month
    ),
    'budget', jsonb_build_object('spent', v_budget_spent, 'total', v_budget_total),
    'low_stock', v_low_stock
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sale(uuid, jsonb, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restock_product(uuid, uuid, integer, numeric, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_daily_series(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_monthly_series(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_expense_categories(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_item_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_recent_transactions(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendor_home_overview(uuid, text) TO authenticated;

-- Refresh PostgREST's schema cache immediately.
NOTIFY pgrst, 'reload schema';

-- ====================================================================
-- 5. 20261021_02_finance_categories.sql
-- Custom expense/income categories and daily/monthly expenses.
-- ====================================================================

ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_entries_frequency_check'
  ) THEN
    ALTER TABLE public.finance_entries
      ADD CONSTRAINT finance_entries_frequency_check
      CHECK (frequency IN ('daily', 'monthly'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, type, name)
);

ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage finance categories" ON public.finance_categories;
CREATE POLICY "Vendors manage finance categories" ON public.finance_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = finance_categories.vendor_id AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = finance_categories.vendor_id AND v.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
-- ====================================================================
-- Vendor profit-month setting: the day of the month a business month
-- starts on (e.g. 25 = 25 Jun → 24 Jul). Safe to re-run.
-- ====================================================================

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS month_start_day smallint NOT NULL DEFAULT 1;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_month_start_day_check;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_month_start_day_check
  CHECK (month_start_day BETWEEN 1 AND 28);

NOTIFY pgrst, 'reload schema';
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

-- ====================================================================
-- 20261029_01_product_photo_gallery.sql
-- ====================================================================

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

-- ====================================================================
-- 20261102_01_dashboard_accounts.sql
-- ====================================================================

-- ====================================================================
-- Business accounts, account movements and the period-based dashboard.
--
-- Available Business Funds = sum(active account opening balances) +
-- sum(account movements). It is deliberately independent of the reporting
-- period. Sales only add the amount actually paid, so unpaid invoices never
-- inflate available funds.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Accounts and append-only account movements
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'cash'
    CHECK (kind IN ('cash', 'bank', 'mtn_momo', 'airtel_money', 'other')),
  opening_balance numeric(14, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, name)
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_vendor_active
  ON public.financial_accounts (vendor_id, is_active);

CREATE TABLE IF NOT EXISTS public.account_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  amount numeric(14, 2) NOT NULL,
  kind text NOT NULL,
  source_type text,
  source_id uuid,
  occurred_on date NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Kampala')::date),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_transactions_vendor_date
  ON public.account_transactions (vendor_id, occurred_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_transactions_account
  ON public.account_transactions (account_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS idx_account_transactions_source
  ON public.account_transactions (vendor_id, source_type, source_id);

-- One sale contributes at most one payment movement.
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_transactions_sale
  ON public.account_transactions (vendor_id, source_id)
  WHERE source_type = 'sale' AND source_id IS NOT NULL;

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors read own accounts" ON public.financial_accounts;
CREATE POLICY "Vendors read own accounts"
  ON public.financial_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = financial_accounts.vendor_id AND v.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors update own accounts" ON public.financial_accounts;
CREATE POLICY "Vendors update own accounts"
  ON public.financial_accounts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = financial_accounts.vendor_id AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = financial_accounts.vendor_id AND v.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors read own account movements" ON public.account_transactions;
CREATE POLICY "Vendors read own account movements"
  ON public.account_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = account_transactions.vendor_id AND v.user_id = auth.uid()
    )
  );

-- Movement rows are written by controlled triggers/functions only.
REVOKE INSERT, UPDATE, DELETE ON public.account_transactions FROM authenticated;

-- --------------------------------------------------------------------
-- 2. Account helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_default_vendor_accounts(p_vendor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.financial_accounts (vendor_id, name, kind)
  VALUES
    (p_vendor_id, 'Cash', 'cash'),
    (p_vendor_id, 'MTN Mobile Money', 'mtn_momo')
  ON CONFLICT (vendor_id, name) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.create_default_vendor_accounts(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.vendors_create_default_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.create_default_vendor_accounts(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendors_create_default_accounts ON public.vendors;
CREATE TRIGGER vendors_create_default_accounts
  AFTER INSERT ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.vendors_create_default_accounts();

CREATE OR REPLACE FUNCTION public.account_for_payment_method(
  p_vendor_id uuid,
  p_method text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_kind text;
  v_id uuid;
  v_method text := COALESCE(NULLIF(btrim(p_method), ''), 'Cash');
BEGIN
  IF v_method ILIKE '%mtn%' OR v_method ILIKE '%mobile money%' THEN
    v_name := 'MTN Mobile Money';
    v_kind := 'mtn_momo';
  ELSIF v_method ILIKE '%airtel%' THEN
    v_name := 'Airtel Money';
    v_kind := 'airtel_money';
  ELSIF v_method ILIKE '%bank%' OR v_method ILIKE '%card%' THEN
    v_name := 'Bank';
    v_kind := 'bank';
  ELSE
    v_name := 'Cash';
    v_kind := 'cash';
  END IF;

  INSERT INTO public.financial_accounts (vendor_id, name, kind)
  VALUES (p_vendor_id, v_name, v_kind)
  ON CONFLICT (vendor_id, name) DO NOTHING;

  SELECT id INTO v_id
  FROM public.financial_accounts
  WHERE vendor_id = p_vendor_id AND name = v_name AND is_active;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.account_for_payment_method(uuid, text) FROM PUBLIC;

-- --------------------------------------------------------------------
-- 3. Keep account movements in sync with sales and finance entries
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_record_account_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount numeric;
  v_account uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.status IN ('cancelled', 'refunded') THEN
    RETURN NEW;
  END IF;

  -- Only money actually received reaches an account. A credit sale with no
  -- payment must not increase Available Business Funds.
  v_amount := CASE
    WHEN NEW.status = 'credit' THEN COALESCE(NEW.paid_amount, 0)
    WHEN COALESCE(NEW.paid_amount, 0) > 0 THEN NEW.paid_amount
    WHEN NEW.status IN ('completed', 'paid') THEN NEW.total
    ELSE COALESCE(NEW.paid_amount, 0)
  END;

  IF COALESCE(v_amount, 0) = 0 THEN
    RETURN NEW;
  END IF;

  v_account := public.account_for_payment_method(NEW.vendor_id, NEW.payment_method);

  INSERT INTO public.account_transactions (
    vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
  )
  VALUES (
    NEW.vendor_id, v_account, v_amount, 'sale_payment', 'sale', NEW.id, NEW.sale_date,
    'Sale ' || COALESCE(NEW.order_no, '')
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_record_account_movement ON public.sales;
CREATE TRIGGER sales_record_account_movement
  AFTER INSERT OR UPDATE OF total, paid_amount, status, payment_method, sale_date ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_record_account_movement();

CREATE OR REPLACE FUNCTION public.finance_entry_account_amount(
  p_type text,
  p_amount numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_type = 'expense' THEN -ABS(COALESCE(p_amount, 0)) ELSE ABS(COALESCE(p_amount, 0)) END;
$$;

CREATE OR REPLACE FUNCTION public.finance_entries_record_account_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_account := public.account_for_payment_method(NEW.vendor_id, 'Cash');

  INSERT INTO public.account_transactions (
    vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
  )
  VALUES (
    NEW.vendor_id,
    v_account,
    public.finance_entry_account_amount(NEW.type, NEW.amount),
    CASE WHEN NEW.type = 'expense' THEN 'expense_payment' ELSE 'other_income' END,
    'finance_entry',
    NEW.id,
    NEW.entry_date,
    COALESCE(NULLIF(NEW.notes, ''), NEW.category)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_entries_record_account_movement ON public.finance_entries;
CREATE TRIGGER finance_entries_record_account_movement
  AFTER INSERT ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.finance_entries_record_account_movement();

CREATE OR REPLACE FUNCTION public.finance_entries_reverse_account_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account uuid;
  v_amount numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NOT NULL THEN
      RETURN OLD;
    END IF;
    v_account := public.account_for_payment_method(OLD.vendor_id, 'Cash');
    v_amount := -public.finance_entry_account_amount(OLD.type, OLD.amount);

    INSERT INTO public.account_transactions (
      vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
    )
    VALUES (
      OLD.vendor_id, v_account, v_amount, 'reversal', 'finance_entry', OLD.id,
      (now() AT TIME ZONE 'Africa/Kampala')::date, 'Deleted finance entry reversed'
    );
    RETURN OLD;
  END IF;

  -- An edit is a reversal plus a fresh movement. History stays append-only.
  IF OLD.deleted_at IS NULL THEN
    v_account := public.account_for_payment_method(OLD.vendor_id, 'Cash');
    v_amount := -public.finance_entry_account_amount(OLD.type, OLD.amount);

    INSERT INTO public.account_transactions (
      vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
    )
    VALUES (
      OLD.vendor_id, v_account, v_amount, 'reversal', 'finance_entry', OLD.id,
      (now() AT TIME ZONE 'Africa/Kampala')::date, 'Edited finance entry reversed'
    );
  END IF;

  IF NEW.deleted_at IS NULL THEN
    v_account := public.account_for_payment_method(NEW.vendor_id, 'Cash');

    INSERT INTO public.account_transactions (
      vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
    )
    VALUES (
      NEW.vendor_id,
      v_account,
      public.finance_entry_account_amount(NEW.type, NEW.amount),
      CASE WHEN NEW.type = 'expense' THEN 'expense_payment' ELSE 'other_income' END,
      'finance_entry',
      NEW.id,
      NEW.entry_date,
      COALESCE(NULLIF(NEW.notes, ''), NEW.category)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_entries_reverse_account_movement ON public.finance_entries;
CREATE TRIGGER finance_entries_reverse_account_movement
  AFTER UPDATE OR DELETE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.finance_entries_reverse_account_movement();

-- --------------------------------------------------------------------
-- 4. Backfill accounts and existing movements
-- --------------------------------------------------------------------
SELECT public.create_default_vendor_accounts(id) FROM public.vendors;

INSERT INTO public.account_transactions (
  vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
)
SELECT
  s.vendor_id,
  public.account_for_payment_method(s.vendor_id, s.payment_method),
  CASE
    WHEN s.status = 'credit' THEN COALESCE(s.paid_amount, 0)
    WHEN COALESCE(s.paid_amount, 0) > 0 THEN s.paid_amount
    WHEN s.status IN ('completed', 'paid') THEN s.total
    ELSE COALESCE(s.paid_amount, 0)
  END,
  'sale_payment',
  'sale',
  s.id,
  s.sale_date,
  'Sale ' || COALESCE(s.order_no, '')
FROM public.sales s
WHERE s.deleted_at IS NULL
  AND s.status NOT IN ('cancelled', 'refunded')
  AND CASE
    WHEN s.status = 'credit' THEN COALESCE(s.paid_amount, 0)
    WHEN COALESCE(s.paid_amount, 0) > 0 THEN s.paid_amount
    WHEN s.status IN ('completed', 'paid') THEN s.total
    ELSE COALESCE(s.paid_amount, 0)
  END <> 0
  AND NOT EXISTS (
    SELECT 1 FROM public.account_transactions at
    WHERE at.source_type = 'sale' AND at.source_id = s.id
  );

INSERT INTO public.account_transactions (
  vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
)
SELECT
  f.vendor_id,
  public.account_for_payment_method(f.vendor_id, 'Cash'),
  public.finance_entry_account_amount(f.type, f.amount),
  CASE WHEN f.type = 'expense' THEN 'expense_payment' ELSE 'other_income' END,
  'finance_entry',
  f.id,
  f.entry_date,
  COALESCE(NULLIF(f.notes, ''), f.category)
FROM public.finance_entries f
WHERE f.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.account_transactions at
    WHERE at.source_type = 'finance_entry' AND at.source_id = f.id
  );

-- --------------------------------------------------------------------
-- 5. Dashboard snapshot: all period sections share p_from/p_to
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_dashboard(
  p_vendor_id uuid,
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from date := COALESCE(p_from, (now() AT TIME ZONE 'Africa/Kampala')::date);
  v_to date := COALESCE(p_to, (now() AT TIME ZONE 'Africa/Kampala')::date);
  v_daily jsonb := '[]'::jsonb;
  v_cash jsonb := '[]'::jsonb;
  v_categories jsonb := '[]'::jsonb;
  v_items jsonb := '[]'::jsonb;
  v_transactions jsonb := '[]'::jsonb;
  v_low_stock jsonb := '[]'::jsonb;
  v_accounts jsonb := '[]'::jsonb;
  v_available numeric := 0;
  v_opening numeric := 0;
  v_movements numeric := 0;
  v_outstanding numeric := 0;
  v_stock_value numeric := 0;
  v_stock_units numeric := 0;
  v_sales numeric := 0;
  v_gross numeric := 0;
  v_reduction numeric := 0;
  v_income numeric := 0;
  v_expenses numeric := 0;
  v_operating numeric := 0;
  v_profit numeric := 0;
  v_orders integer := 0;
  v_customers integer := 0;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  IF v_to < v_from THEN
    RAISE EXCEPTION 'The end date must be on or after the start date';
  END IF;

  v_daily := public.vendor_daily_series(p_vendor_id, v_from, v_to);

  SELECT
    COALESCE(SUM((item->>'sales')::numeric), 0),
    COALESCE(SUM((item->>'gross_profit')::numeric), 0),
    COALESCE(SUM(GREATEST((item->>'price_reduction')::numeric, 0)), 0),
    COALESCE(SUM((item->>'other_income')::numeric), 0),
    COALESCE(SUM((item->>'expenses')::numeric), 0),
    COALESCE(SUM((item->>'operating_expenses')::numeric), 0),
    COALESCE(SUM((item->>'net_profit')::numeric), 0)
  INTO v_sales, v_gross, v_reduction, v_income, v_expenses, v_operating, v_profit
  FROM jsonb_array_elements(v_daily) item;

  SELECT COUNT(*)::integer INTO v_orders
  FROM public.sales
  WHERE vendor_id = p_vendor_id
    AND deleted_at IS NULL
    AND sale_date >= v_from AND sale_date <= v_to;

  SELECT COUNT(DISTINCT COALESCE(NULLIF(btrim(customer_phone), ''), NULLIF(lower(btrim(customer_name)), '')))::integer
  INTO v_customers
  FROM public.sales
  WHERE vendor_id = p_vendor_id
    AND deleted_at IS NULL
    AND sale_date >= v_from AND sale_date <= v_to;

  WITH days AS (
    SELECT generate_series(v_from, v_to, interval '1 day')::date AS day
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'day', d.day,
        'cash_in', COALESCE(ci.total, 0),
        'cash_out', COALESCE(co.total, 0)
      ) ORDER BY d.day
    ),
    '[]'::jsonb
  )
  INTO v_cash
  FROM days d
  LEFT JOIN LATERAL (
    SELECT SUM(amount) AS total
    FROM public.account_transactions
    WHERE vendor_id = p_vendor_id
      AND occurred_on = d.day
      AND amount > 0
      AND kind <> 'transfer'
  ) ci ON true
  LEFT JOIN LATERAL (
    SELECT -SUM(amount) AS total
    FROM public.account_transactions
    WHERE vendor_id = p_vendor_id
      AND occurred_on = d.day
      AND amount < 0
      AND kind <> 'transfer'
  ) co ON true;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('category', category, 'total', total)
      ORDER BY total DESC, category
    ),
    '[]'::jsonb
  )
  INTO v_categories
  FROM (
    SELECT category, SUM(amount) AS total
    FROM public.finance_entries
    WHERE vendor_id = p_vendor_id
      AND type = 'expense'
      AND deleted_at IS NULL
      AND entry_date >= v_from AND entry_date <= v_to
    GROUP BY category
  ) rows;

  WITH sold AS (
    SELECT
      si.product_name AS name,
      SUM(si.quantity) AS qty,
      SUM(si.sold_price * si.quantity) AS sold_total,
      SUM(si.listed_price * si.quantity) AS listed_total,
      SUM(si.unit_cost * si.quantity) AS cost_total
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE si.vendor_id = p_vendor_id
      AND s.vendor_id = p_vendor_id
      AND s.deleted_at IS NULL
      AND s.sale_date >= v_from AND s.sale_date <= v_to
    GROUP BY si.product_name
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'name', rows.name,
        'cost', CASE WHEN rows.qty > 0 THEN rows.cost_total / rows.qty ELSE 0 END,
        'expected', CASE WHEN rows.qty > 0 THEN rows.listed_total / rows.qty ELSE 0 END,
        'actual', CASE WHEN rows.qty > 0 THEN rows.sold_total / rows.qty ELSE 0 END,
        'sold', rows.qty
      ) ORDER BY rows.qty DESC, rows.sold_total DESC, rows.name
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM (
    SELECT * FROM sold
    ORDER BY qty DESC, sold_total DESC, name
    LIMIT 12
  ) rows;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'kind', kind,
        'title', title,
        'category', category,
        'amount', amount,
        'date', entry_date,
        'ts', created_at,
        'items', items
      ) ORDER BY entry_date DESC, created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_transactions
  FROM (
    SELECT * FROM (
      SELECT
        s.id,
        'sale'::text AS kind,
        'Sales'::text AS title,
        'Sales'::text AS category,
        s.total AS amount,
        s.sale_date AS entry_date,
        s.created_at,
        (
          SELECT jsonb_agg(product_name)
          FROM (
            SELECT product_name FROM public.sale_items WHERE sale_id = s.id LIMIT 2
          ) names
        ) AS items
      FROM public.sales s
      WHERE s.vendor_id = p_vendor_id
        AND s.deleted_at IS NULL
        AND s.sale_date >= v_from AND s.sale_date <= v_to

      UNION ALL

      SELECT
        f.id,
        'expense'::text,
        COALESCE(NULLIF(f.notes, ''), f.category),
        f.category,
        -f.amount,
        f.entry_date,
        f.created_at,
        NULL::jsonb
      FROM public.finance_entries f
      WHERE f.vendor_id = p_vendor_id
        AND f.type = 'expense'
        AND f.deleted_at IS NULL
        AND f.entry_date >= v_from AND f.entry_date <= v_to

      UNION ALL

      SELECT
        f.id,
        'income'::text,
        f.category,
        'Other Income'::text,
        f.amount,
        f.entry_date,
        f.created_at,
        NULL::jsonb
      FROM public.finance_entries f
      WHERE f.vendor_id = p_vendor_id
        AND f.type = 'income'
        AND f.deleted_at IS NULL
        AND f.entry_date >= v_from AND f.entry_date <= v_to
    ) all_rows
    ORDER BY entry_date DESC, created_at DESC
    LIMIT 100
  ) rows;

  SELECT COALESCE(SUM(opening_balance), 0)
  INTO v_opening
  FROM public.financial_accounts
  WHERE vendor_id = p_vendor_id AND is_active;

  SELECT COALESCE(SUM(at.amount), 0)
  INTO v_movements
  FROM public.account_transactions at
  JOIN public.financial_accounts a ON a.id = at.account_id
  WHERE at.vendor_id = p_vendor_id AND a.is_active;

  v_available := v_opening + v_movements;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'kind', a.kind,
        'opening_balance', a.opening_balance,
        'balance', a.opening_balance + COALESCE(t.total, 0),
        'is_active', a.is_active
      ) ORDER BY a.created_at, a.name
    ),
    '[]'::jsonb
  )
  INTO v_accounts
  FROM public.financial_accounts a
  LEFT JOIN (
    SELECT account_id, SUM(amount) AS total
    FROM public.account_transactions
    WHERE vendor_id = p_vendor_id
    GROUP BY account_id
  ) t ON t.account_id = a.id
  WHERE a.vendor_id = p_vendor_id AND a.is_active;

  SELECT COALESCE(SUM(GREATEST(GREATEST(COALESCE(s.due_amount, 0), COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0)), 0)), 0)
  INTO v_outstanding
  FROM public.sales s
  WHERE s.vendor_id = p_vendor_id
    AND s.deleted_at IS NULL
    AND s.status NOT IN ('cancelled', 'refunded');

  SELECT
    COALESCE(SUM(GREATEST(p.stock, 0) * COALESCE(p.cost, 0)), 0),
    COALESCE(SUM(GREATEST(p.stock, 0)), 0)
  INTO v_stock_value, v_stock_units
  FROM public.products p
  WHERE p.vendor_id = p_vendor_id AND p.deleted_at IS NULL;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'stock', p.stock,
        'category', p.category,
        'photo_url', p.photo_url,
        'price', p.price,
        'cost', p.cost,
        'discount_pct', p.discount_pct
      ) ORDER BY p.stock ASC, p.name
    ),
    '[]'::jsonb
  )
  INTO v_low_stock
  FROM (
    SELECT * FROM public.products
    WHERE vendor_id = p_vendor_id AND deleted_at IS NULL AND stock <= 3
    ORDER BY stock ASC, name
    LIMIT 12
  ) p;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'from', v_from,
      'to', v_to,
      'sales', v_sales,
      'gross_profit', v_gross,
      'price_reduction', v_reduction,
      'other_income', v_income,
      'expenses', v_expenses,
      'operating_expenses', v_operating,
      'net_profit', v_profit,
      'orders', v_orders,
      'customers', v_customers
    ),
    'daily', v_daily,
    'cash', v_cash,
    'categories', v_categories,
    'items', v_items,
    'transactions', v_transactions,
    'current', jsonb_build_object(
      'available_funds', v_available,
      'customer_outstanding', v_outstanding,
      'stock_value', v_stock_value,
      'stock_units', v_stock_units,
      'accounts', v_accounts
    ),
    'low_stock', v_low_stock
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_dashboard(uuid, date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ====================================================================
-- 9. 20261102_02_business_account_management.sql
-- ====================================================================

-- ====================================================================
-- Business account management: manual accounts, transfers and safe
-- deactivation.
--
-- Balances are never stored on the account. They are always derived as:
--   opening_balance + SUM(account_transactions.amount)
-- Account history is append-only; deactivating an account only flips
-- is_active after its derived balance is zero, so money cannot silently
-- disappear.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Account metadata used by the management UI
-- --------------------------------------------------------------------
ALTER TABLE public.financial_accounts
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS icon text;

-- Existing accounts keep their kind. New manual accounts can use a generic
-- mobile-money or savings type in addition to the original kinds.
ALTER TABLE public.financial_accounts
  DROP CONSTRAINT IF EXISTS financial_accounts_kind_check;

ALTER TABLE public.financial_accounts
  ADD CONSTRAINT financial_accounts_kind_check
  CHECK (kind IN ('cash', 'bank', 'mtn_momo', 'airtel_money', 'mobile_money', 'savings', 'other'));

CREATE INDEX IF NOT EXISTS idx_financial_accounts_vendor_created
  ON public.financial_accounts (vendor_id, created_at);

-- --------------------------------------------------------------------
-- 2. Create and edit accounts
-- --------------------------------------------------------------------

-- One place that validates an account type so direct API calls and the UI
-- cannot disagree.
CREATE OR REPLACE FUNCTION public.is_valid_account_kind(p_kind text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_kind, '') IN
    ('cash', 'bank', 'mtn_momo', 'airtel_money', 'mobile_money', 'savings', 'other');
$$;

-- Payment methods only care about the broad group (cash / bank / mobile), so
-- a manual "Mobile Money" account can receive MTN and Airtel sales too.
CREATE OR REPLACE FUNCTION public.account_kind_group(p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_kind, '') IN ('mtn_momo', 'airtel_money', 'mobile_money') THEN 'mobile'
    ELSE COALESCE(NULLIF(p_kind, ''), 'other')
  END;
$$;

-- Keep sale payment-method mapping working when the named default account is
-- inactive. It falls back to any active account in the same group.
CREATE OR REPLACE FUNCTION public.account_for_payment_method(
  p_vendor_id uuid,
  p_method text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text;
  v_kind text;
  v_id uuid;
  v_method text := COALESCE(NULLIF(btrim(p_method), ''), 'Cash');
BEGIN
  IF v_method ILIKE '%mtn%' OR v_method ILIKE '%mobile money%' THEN
    v_name := 'MTN Mobile Money';
    v_kind := 'mtn_momo';
  ELSIF v_method ILIKE '%airtel%' THEN
    v_name := 'Airtel Money';
    v_kind := 'airtel_money';
  ELSIF v_method ILIKE '%bank%' OR v_method ILIKE '%card%' THEN
    v_name := 'Bank';
    v_kind := 'bank';
  ELSE
    v_name := 'Cash';
    v_kind := 'cash';
  END IF;

  INSERT INTO public.financial_accounts (vendor_id, name, kind)
  VALUES (p_vendor_id, v_name, v_kind)
  ON CONFLICT (vendor_id, name) DO NOTHING;

  SELECT id INTO v_id
  FROM public.financial_accounts
  WHERE vendor_id = p_vendor_id AND name = v_name AND is_active;

  IF v_id IS NULL THEN
    SELECT id INTO v_id
    FROM public.financial_accounts
    WHERE vendor_id = p_vendor_id
      AND public.account_kind_group(kind) = public.account_kind_group(v_kind)
      AND is_active
    ORDER BY created_at, name
    LIMIT 1;
  END IF;

  -- Last resort for older data: a payment must still land somewhere. The
  -- management UI prevents this path by keeping one active account per group.
  IF v_id IS NULL THEN
    UPDATE public.financial_accounts
    SET is_active = true, updated_at = now()
    WHERE vendor_id = p_vendor_id AND name = v_name
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.account_for_payment_method(uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.create_financial_account(
  p_vendor_id uuid,
  p_name text,
  p_kind text DEFAULT 'cash',
  p_opening_balance numeric DEFAULT 0,
  p_description text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_icon text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text := btrim(COALESCE(p_name, ''));
  v_kind text := COALESCE(NULLIF(btrim(p_kind), ''), 'cash');
  v_opening numeric := ROUND(COALESCE(p_opening_balance, 0));
  v_description text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_color text := NULLIF(btrim(COALESCE(p_color, '')), '');
  v_icon text := NULLIF(btrim(COALESCE(p_icon, '')), '');
  v_account public.financial_accounts;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  IF v_name = '' THEN
    RAISE EXCEPTION 'Enter an account name';
  END IF;
  IF char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'Account names must be 80 characters or fewer';
  END IF;
  IF NOT public.is_valid_account_kind(v_kind) THEN
    RAISE EXCEPTION 'Choose a valid account type';
  END IF;
  IF v_description IS NOT NULL AND char_length(v_description) > 300 THEN
    RAISE EXCEPTION 'Descriptions must be 300 characters or fewer';
  END IF;
  IF v_color IS NOT NULL AND v_color !~* '^#[0-9a-f]{6}$' THEN
    RAISE EXCEPTION 'Choose a valid account colour';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_accounts
    WHERE vendor_id = p_vendor_id AND lower(name) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'An account with this name already exists';
  END IF;

  INSERT INTO public.financial_accounts (
    vendor_id, name, kind, opening_balance, description, color, icon, is_active
  )
  VALUES (
    p_vendor_id, v_name, v_kind, v_opening, v_description, v_color, v_icon, true
  )
  RETURNING * INTO v_account;

  RETURN jsonb_build_object(
    'id', v_account.id,
    'name', v_account.name,
    'kind', v_account.kind,
    'opening_balance', v_account.opening_balance,
    'description', v_account.description,
    'color', v_account.color,
    'icon', v_account.icon,
    'is_active', v_account.is_active
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_financial_account(
  p_vendor_id uuid,
  p_account_id uuid,
  p_name text,
  p_kind text DEFAULT 'cash',
  p_description text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_icon text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name text := btrim(COALESCE(p_name, ''));
  v_kind text := COALESCE(NULLIF(btrim(p_kind), ''), 'cash');
  v_description text := NULLIF(btrim(COALESCE(p_description, '')), '');
  v_color text := NULLIF(btrim(COALESCE(p_color, '')), '');
  v_icon text := NULLIF(btrim(COALESCE(p_icon, '')), '');
  v_account public.financial_accounts;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  SELECT * INTO v_account
  FROM public.financial_accounts
  WHERE id = p_account_id AND vendor_id = p_vendor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'Enter an account name';
  END IF;
  IF char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'Account names must be 80 characters or fewer';
  END IF;
  IF NOT public.is_valid_account_kind(v_kind) THEN
    RAISE EXCEPTION 'Choose a valid account type';
  END IF;
  IF v_description IS NOT NULL AND char_length(v_description) > 300 THEN
    RAISE EXCEPTION 'Descriptions must be 300 characters or fewer';
  END IF;
  IF v_color IS NOT NULL AND v_color !~* '^#[0-9a-f]{6}$' THEN
    RAISE EXCEPTION 'Choose a valid account colour';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_accounts
    WHERE vendor_id = p_vendor_id
      AND id <> p_account_id
      AND lower(name) = lower(v_name)
  ) THEN
    RAISE EXCEPTION 'An account with this name already exists';
  END IF;

  UPDATE public.financial_accounts
  SET
    name = v_name,
    kind = v_kind,
    description = v_description,
    color = v_color,
    icon = v_icon,
    updated_at = now()
  WHERE id = p_account_id AND vendor_id = p_vendor_id
  RETURNING * INTO v_account;

  RETURN jsonb_build_object(
    'id', v_account.id,
    'name', v_account.name,
    'kind', v_account.kind,
    'opening_balance', v_account.opening_balance,
    'description', v_account.description,
    'color', v_account.color,
    'icon', v_account.icon,
    'is_active', v_account.is_active
  );
END;
$$;

-- --------------------------------------------------------------------
-- 3. Safe deactivation / reactivation
-- --------------------------------------------------------------------

-- Deactivating an account is only allowed when its derived balance is zero.
-- The vendor must transfer the remaining money first, so history and money
-- are never silently discarded.
CREATE OR REPLACE FUNCTION public.set_financial_account_active(
  p_vendor_id uuid,
  p_account_id uuid,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account public.financial_accounts;
  v_balance numeric;
  v_group text;
  v_group_label text;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  SELECT * INTO v_account
  FROM public.financial_accounts
  WHERE id = p_account_id AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF p_active THEN
    IF v_account.is_active THEN
      RETURN jsonb_build_object('id', v_account.id, 'is_active', true);
    END IF;

    UPDATE public.financial_accounts
    SET is_active = true, updated_at = now()
    WHERE id = p_account_id AND vendor_id = p_vendor_id;

    RETURN jsonb_build_object('id', p_account_id, 'is_active', true);
  END IF;

  IF NOT v_account.is_active THEN
    RETURN jsonb_build_object('id', v_account.id, 'is_active', false);
  END IF;

  SELECT v_account.opening_balance + COALESCE(SUM(amount), 0)
  INTO v_balance
  FROM public.account_transactions
  WHERE account_id = p_account_id AND vendor_id = p_vendor_id;

  IF v_balance <> 0 THEN
    RAISE EXCEPTION
      'This account still holds UGX %. Transfer the balance to another account before deactivating it.',
      to_char(v_balance, 'FM999G999G999G990');
  END IF;

  -- Cash, bank and mobile-money accounts are used by sale payment methods.
  -- Keep one active account in each group so recording a sale cannot fail.
  v_group := public.account_kind_group(v_account.kind);
  IF v_group IN ('cash', 'bank', 'mobile') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_accounts
      WHERE vendor_id = p_vendor_id
        AND id <> p_account_id
        AND is_active
        AND public.account_kind_group(kind) = v_group
    ) THEN
      v_group_label := CASE
        WHEN v_group = 'cash' THEN 'cash'
        WHEN v_group = 'bank' THEN 'bank'
        ELSE 'mobile money'
      END;
      RAISE EXCEPTION
        'Keep at least one active % account so payments can still be recorded.',
        v_group_label;
    END IF;
  END IF;

  UPDATE public.financial_accounts
  SET is_active = false, updated_at = now()
  WHERE id = p_account_id AND vendor_id = p_vendor_id;

  RETURN jsonb_build_object('id', p_account_id, 'is_active', false);
END;
$$;

-- --------------------------------------------------------------------
-- 4. Transfers: two linked append-only movements
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_between_accounts(
  p_vendor_id uuid,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount numeric := ROUND(COALESCE(p_amount, 0));
  v_from public.financial_accounts;
  v_to public.financial_accounts;
  v_from_balance numeric;
  v_transfer_id uuid := gen_random_uuid();
  v_notes text := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  IF p_from_account_id IS NULL OR p_to_account_id IS NULL THEN
    RAISE EXCEPTION 'Choose both accounts';
  END IF;
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Choose two different accounts';
  END IF;
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Enter an amount greater than zero';
  END IF;

  -- Lock in a stable order so two simultaneous opposite transfers cannot
  -- deadlock each other.
  PERFORM 1
  FROM public.financial_accounts
  WHERE vendor_id = p_vendor_id
    AND id IN (p_from_account_id, p_to_account_id)
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO v_from
  FROM public.financial_accounts
  WHERE id = p_from_account_id AND vendor_id = p_vendor_id;

  SELECT * INTO v_to
  FROM public.financial_accounts
  WHERE id = p_to_account_id AND vendor_id = p_vendor_id;

  IF v_from.id IS NULL OR v_to.id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  IF NOT v_from.is_active OR NOT v_to.is_active THEN
    RAISE EXCEPTION 'Both accounts must be active for a transfer';
  END IF;

  SELECT v_from.opening_balance + COALESCE(SUM(amount), 0)
  INTO v_from_balance
  FROM public.account_transactions
  WHERE account_id = p_from_account_id AND vendor_id = p_vendor_id;

  IF v_from_balance < v_amount THEN
    RAISE EXCEPTION
      'Not enough money in %. Available: UGX %',
      v_from.name,
      to_char(v_from_balance, 'FM999G999G999G990');
  END IF;

  INSERT INTO public.account_transactions (
    vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
  )
  VALUES
    (
      p_vendor_id,
      p_from_account_id,
      -v_amount,
      'transfer',
      'transfer',
      v_transfer_id,
      v_today,
      COALESCE(v_notes, 'Transfer to ' || v_to.name)
    ),
    (
      p_vendor_id,
      p_to_account_id,
      v_amount,
      'transfer',
      'transfer',
      v_transfer_id,
      v_today,
      COALESCE(v_notes, 'Transfer from ' || v_from.name)
    );

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'from_account_id', p_from_account_id,
    'to_account_id', p_to_account_id,
    'amount', v_amount,
    'occurred_on', v_today
  );
END;
$$;

-- --------------------------------------------------------------------
-- 5. Overview read used by the accounts page
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_accounts_overview(
  p_vendor_id uuid,
  p_transaction_limit integer DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_transaction_limit, 200), 1), 500);
  v_accounts jsonb := '[]'::jsonb;
  v_transactions jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', rows.id,
        'name', rows.name,
        'kind', rows.kind,
        'opening_balance', rows.opening_balance,
        'description', rows.description,
        'color', rows.color,
        'icon', rows.icon,
        'is_active', rows.is_active,
        'balance', rows.balance,
        'movement_count', rows.movement_count,
        'last_activity', rows.last_activity
      ) ORDER BY rows.is_active DESC, rows.created_at, rows.name
    ),
    '[]'::jsonb
  )
  INTO v_accounts
  FROM (
    SELECT
      a.id,
      a.name,
      a.kind,
      a.opening_balance,
      a.description,
      a.color,
      a.icon,
      a.is_active,
      a.created_at,
      a.opening_balance + COALESCE(t.total, 0) AS balance,
      COALESCE(t.movement_count, 0) AS movement_count,
      t.last_activity
    FROM public.financial_accounts a
    LEFT JOIN (
      SELECT
        account_id,
        SUM(amount) AS total,
        COUNT(*)::integer AS movement_count,
        MAX(occurred_on) AS last_activity
      FROM public.account_transactions
      WHERE vendor_id = p_vendor_id
      GROUP BY account_id
    ) t ON t.account_id = a.id
    WHERE a.vendor_id = p_vendor_id
  ) rows;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', rows.id,
        'account_id', rows.account_id,
        'account_name', rows.account_name,
        'amount', rows.amount,
        'kind', rows.kind,
        'source_type', rows.source_type,
        'source_id', rows.source_id,
        'occurred_on', rows.occurred_on,
        'notes', rows.notes,
        'created_at', rows.created_at
      ) ORDER BY rows.occurred_on DESC, rows.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_transactions
  FROM (
    SELECT
      tx.id,
      tx.account_id,
      a.name AS account_name,
      tx.amount,
      tx.kind,
      tx.source_type,
      tx.source_id,
      tx.occurred_on,
      tx.notes,
      tx.created_at
    FROM public.account_transactions tx
    JOIN public.financial_accounts a ON a.id = tx.account_id
    WHERE tx.vendor_id = p_vendor_id
    ORDER BY tx.occurred_on DESC, tx.created_at DESC
    LIMIT v_limit
  ) rows;

  RETURN jsonb_build_object(
    'accounts', v_accounts,
    'transactions', v_transactions
  );
END;
$$;

-- --------------------------------------------------------------------
-- 6. Permissions
-- --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_valid_account_kind(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_account_kind(text) TO authenticated;

REVOKE ALL ON FUNCTION public.create_financial_account(uuid, text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_financial_account(uuid, text, text, numeric, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.update_financial_account(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_financial_account(uuid, uuid, text, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.set_financial_account_active(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_financial_account_active(uuid, uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.transfer_between_accounts(uuid, uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_between_accounts(uuid, uuid, uuid, numeric, text) TO authenticated;

REVOKE ALL ON FUNCTION public.vendor_accounts_overview(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_accounts_overview(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ====================================================================
-- 10. 20261102_03_stock_purchases.sql
-- ====================================================================

-- ====================================================================
-- Stock purchases connected to business accounts.
--
-- One atomic RPC records the purchase, increases stock, writes stock
-- movements, records the selected account payment and stores the supplier
-- payable. Account money only moves for the amount actually paid.
--
-- Idempotency: a unique (vendor_id, idempotency_key) purchase makes a
-- retried submit return the original purchase without changing stock or
-- account balances twice.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Purchase payment fields
-- --------------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE INDEX IF NOT EXISTS idx_purchases_vendor_date
  ON public.purchases (vendor_id, purchase_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_purchases_vendor_due
  ON public.purchases (vendor_id, purchase_date DESC)
  WHERE due_amount > 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchases_idempotency
  ON public.purchases (vendor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- A purchase can create at most one account payment movement.
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_transactions_purchase
  ON public.account_transactions (vendor_id, source_id)
  WHERE source_type = 'purchase' AND source_id IS NOT NULL;

-- --------------------------------------------------------------------
-- 2. Record a multi-product stock purchase
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_stock_purchase(
  p_vendor_id uuid,
  p_items jsonb,
  p_account_id uuid DEFAULT NULL,
  p_amount_paid numeric DEFAULT 0,
  p_supplier_name text DEFAULT NULL,
  p_purchase_date date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  v_date date := COALESCE(p_purchase_date, (now() AT TIME ZONE 'Africa/Kampala')::date);
  v_key text := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_items jsonb := COALESCE(p_items, '[]'::jsonb);
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_account public.financial_accounts%ROWTYPE;
  v_purchase public.purchases%ROWTYPE;
  v_existing public.purchases%ROWTYPE;
  v_purchase_id uuid;
  v_product_id uuid;
  v_seen uuid[] := '{}';
  v_qty integer;
  v_cost numeric;
  v_total numeric := 0;
  v_amount_paid numeric := ROUND(COALESCE(p_amount_paid, 0));
  v_due numeric := 0;
  v_account_balance numeric := NULL;
  v_account_balance_after numeric := NULL;
  v_supplier text := NULLIF(btrim(COALESCE(p_supplier_name, '')), '');
  v_notes text := NULLIF(btrim(COALESCE(p_notes, '')), '');
  v_reference text;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  IF jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one product to the purchase';
  END IF;

  IF v_supplier IS NOT NULL AND char_length(v_supplier) > 120 THEN
    RAISE EXCEPTION 'Supplier name must be 120 characters or fewer';
  END IF;
  IF v_notes IS NOT NULL AND char_length(v_notes) > 500 THEN
    RAISE EXCEPTION 'Notes must be 500 characters or fewer';
  END IF;
  IF v_date > v_today THEN
    v_date := v_today;
  END IF;

  -- Fast path for a retry: return the original purchase before touching stock.
  IF v_key IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.purchases
    WHERE vendor_id = p_vendor_id AND idempotency_key = v_key;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'purchase_id', v_existing.id,
        'reference_no', v_existing.reference_no,
        'total_amount', v_existing.total_amount,
        'paid_amount', v_existing.paid_amount,
        'due_amount', v_existing.due_amount,
        'supplier_name', v_existing.supplier_name,
        'account_id', v_existing.account_id,
        'duplicate', true
      );
    END IF;
  ELSE
    v_key := gen_random_uuid()::text;
  END IF;

  -- First pass: validate, lock products and compute the total.
  -- Locking in product-id order prevents deadlocks between two purchases.
  FOR v_item IN
    SELECT value
    FROM jsonb_array_elements(v_items)
    ORDER BY value->>'product_id'
  LOOP
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'A purchase line is missing its product';
    END IF;
    IF v_product_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'Each product can only appear once in a purchase';
    END IF;
    v_seen := array_append(v_seen, v_product_id);

    v_qty := COALESCE((v_item->>'qty')::integer, (v_item->>'quantity')::integer);
    IF v_qty IS NULL OR v_qty < 1 THEN
      RAISE EXCEPTION 'Enter a quantity greater than zero for every product';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id AND vendor_id = p_vendor_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in this purchase no longer exists';
    END IF;

    v_cost := COALESCE(
      NULLIF(v_item->>'unit_cost', '')::numeric,
      NULLIF(v_item->>'cost', '')::numeric,
      v_product.cost,
      0
    );
    IF v_cost < 0 THEN
      RAISE EXCEPTION 'Purchase costs cannot be negative';
    END IF;
    v_cost := ROUND(v_cost);

    v_total := v_total + ROUND(v_qty::numeric * v_cost);
  END LOOP;

  v_total := ROUND(v_total);

  IF v_amount_paid < 0 THEN
    RAISE EXCEPTION 'Amount paid cannot be negative';
  END IF;
  IF v_amount_paid > v_total THEN
    RAISE EXCEPTION 'Amount paid cannot be more than the total purchase cost';
  END IF;

  v_due := v_total - v_amount_paid;

  IF v_amount_paid > 0 THEN
    IF p_account_id IS NULL THEN
      RAISE EXCEPTION 'Choose the account used to pay';
    END IF;

    SELECT * INTO v_account
    FROM public.financial_accounts
    WHERE id = p_account_id AND vendor_id = p_vendor_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Payment account not found';
    END IF;
    IF NOT v_account.is_active THEN
      RAISE EXCEPTION 'Choose an active account for this payment';
    END IF;

    SELECT v_account.opening_balance + COALESCE(SUM(amount), 0)
    INTO v_account_balance
    FROM public.account_transactions
    WHERE account_id = p_account_id AND vendor_id = p_vendor_id;

    IF v_account_balance < v_amount_paid THEN
      RAISE EXCEPTION
        'Not enough money in %. Available: UGX %',
        v_account.name,
        to_char(v_account_balance, 'FM999G999G999G990');
    END IF;
  END IF;

  v_reference := 'P-' || to_char(v_date, 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- The unique partial index is the concurrency guard for duplicate submits.
  INSERT INTO public.purchases (
    vendor_id, supplier_name, account_id, reference_no, purchase_date,
    total_amount, paid_amount, due_amount, notes, idempotency_key
  )
  VALUES (
    p_vendor_id,
    v_supplier,
    CASE WHEN v_amount_paid > 0 THEN p_account_id ELSE NULL END,
    v_reference,
    v_date,
    v_total,
    v_amount_paid,
    v_due,
    v_notes,
    v_key
  )
  ON CONFLICT (vendor_id, idempotency_key) WHERE idempotency_key IS NOT NULL
  DO NOTHING
  RETURNING * INTO v_purchase;

  IF v_purchase.id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.purchases
    WHERE vendor_id = p_vendor_id AND idempotency_key = v_key;

    RETURN jsonb_build_object(
      'purchase_id', v_existing.id,
      'reference_no', v_existing.reference_no,
      'total_amount', v_existing.total_amount,
      'paid_amount', v_existing.paid_amount,
      'due_amount', v_existing.due_amount,
      'supplier_name', v_existing.supplier_name,
      'account_id', v_existing.account_id,
      'duplicate', true
    );
  END IF;

  v_purchase_id := v_purchase.id;

  -- Second pass: write purchase lines, stock and stock movements together.
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'qty')::integer, (v_item->>'quantity')::integer);

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_product_id AND vendor_id = p_vendor_id
    FOR UPDATE;

    v_cost := COALESCE(
      NULLIF(v_item->>'unit_cost', '')::numeric,
      NULLIF(v_item->>'cost', '')::numeric,
      v_product.cost,
      0
    );
    v_cost := ROUND(v_cost);

    UPDATE public.products
    SET
      stock = COALESCE(stock, 0) + v_qty,
      cost = v_cost,
      updated_at = now()
    WHERE id = v_product_id AND vendor_id = p_vendor_id;

    INSERT INTO public.stock_movements (vendor_id, product_id, delta, reason)
    VALUES (p_vendor_id, v_product_id, v_qty, 'restock');

    INSERT INTO public.purchase_items (
      purchase_id, vendor_id, product_id, quantity, unit_cost, total_cost
    )
    VALUES (
      v_purchase_id, p_vendor_id, v_product_id, v_qty, v_cost,
      ROUND(v_qty::numeric * v_cost)
    );
  END LOOP;

  -- Only money actually paid reaches an account. Credit stays as a payable.
  IF v_amount_paid > 0 THEN
    INSERT INTO public.account_transactions (
      vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
    )
    VALUES (
      p_vendor_id,
      p_account_id,
      -v_amount_paid,
      'stock_purchase_payment',
      'purchase',
      v_purchase_id,
      v_date,
      'Stock purchase ' || v_reference ||
        CASE WHEN v_supplier IS NOT NULL THEN ' · ' || v_supplier ELSE '' END
    );

    v_account_balance_after := v_account_balance - v_amount_paid;
  END IF;

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'reference_no', v_reference,
    'total_amount', v_total,
    'paid_amount', v_amount_paid,
    'due_amount', v_due,
    'supplier_name', v_supplier,
    'account_id', CASE WHEN v_amount_paid > 0 THEN p_account_id ELSE NULL END,
    'account_name', CASE WHEN v_amount_paid > 0 THEN v_account.name ELSE NULL END,
    'account_balance_after', v_account_balance_after,
    'duplicate', false
  );
END;
$$;

-- --------------------------------------------------------------------
-- 3. Purchase overview for the stock screen
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_purchases_overview(
  p_vendor_id uuid,
  p_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_purchases jsonb := '[]'::jsonb;
  v_payables jsonb := '[]'::jsonb;
  v_outstanding numeric := 0;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  WITH recent AS (
    SELECT
      p.id,
      p.reference_no,
      p.supplier_name,
      p.account_id,
      a.name AS account_name,
      p.purchase_date,
      p.total_amount,
      p.paid_amount,
      p.due_amount,
      p.notes,
      p.created_at
    FROM public.purchases p
    LEFT JOIN public.financial_accounts a ON a.id = p.account_id
    WHERE p.vendor_id = p_vendor_id AND p.deleted_at IS NULL
    ORDER BY p.purchase_date DESC, p.created_at DESC
    LIMIT v_limit
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'reference_no', r.reference_no,
        'supplier_name', r.supplier_name,
        'account_id', r.account_id,
        'account_name', r.account_name,
        'purchase_date', r.purchase_date,
        'total_amount', r.total_amount,
        'paid_amount', r.paid_amount,
        'due_amount', r.due_amount,
        'notes', r.notes,
        'created_at', r.created_at,
        'items', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'product_id', pi.product_id,
              'product_name', pr.name,
              'quantity', pi.quantity,
              'unit_cost', pi.unit_cost,
              'total_cost', pi.total_cost
            ) ORDER BY pi.created_at
          )
          FROM public.purchase_items pi
          LEFT JOIN public.products pr ON pr.id = pi.product_id
          WHERE pi.purchase_id = r.id
        ), '[]'::jsonb)
      ) ORDER BY r.purchase_date DESC, r.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_purchases
  FROM recent r;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'supplier_name', rows.supplier_name,
        'due_amount', rows.due_amount,
        'purchase_count', rows.purchase_count,
        'last_purchase_date', rows.last_purchase_date
      ) ORDER BY rows.due_amount DESC, rows.supplier_name
    ),
    '[]'::jsonb
  )
  INTO v_payables
  FROM (
    SELECT
      COALESCE(NULLIF(btrim(supplier_name), ''), 'Unspecified supplier') AS supplier_name,
      SUM(due_amount) AS due_amount,
      COUNT(*)::integer AS purchase_count,
      MAX(purchase_date) AS last_purchase_date
    FROM public.purchases
    WHERE vendor_id = p_vendor_id
      AND deleted_at IS NULL
      AND due_amount > 0
    GROUP BY 1
  ) rows;

  SELECT COALESCE(SUM(due_amount), 0)
  INTO v_outstanding
  FROM public.purchases
  WHERE vendor_id = p_vendor_id
    AND deleted_at IS NULL
    AND due_amount > 0;

  RETURN jsonb_build_object(
    'purchases', v_purchases,
    'supplier_payables', v_payables,
    'outstanding', v_outstanding
  );
END;
$$;

-- --------------------------------------------------------------------
-- 4. Permissions
-- --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.record_stock_purchase(uuid, jsonb, uuid, numeric, text, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_stock_purchase(uuid, jsonb, uuid, numeric, text, date, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.vendor_purchases_overview(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_purchases_overview(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- ====================================================================
-- 11. 20261102_04_money_management.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Link finance entries to the account that moved the money
-- --------------------------------------------------------------------
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_finance_entries_account
  ON public.finance_entries (account_id);

-- --------------------------------------------------------------------
-- 2. Resolve a safe target account
-- --------------------------------------------------------------------
-- Uses the selected account only when it belongs to the same vendor. Older
-- rows (and any client that has not been updated yet) fall back to Cash.
CREATE OR REPLACE FUNCTION public.finance_entry_target_account(
  p_vendor_id uuid,
  p_account_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_account_id IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.financial_accounts
    WHERE id = p_account_id AND vendor_id = p_vendor_id;

    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  RETURN public.account_for_payment_method(p_vendor_id, 'Cash');
END;
$$;

REVOKE ALL ON FUNCTION public.finance_entry_target_account(uuid, uuid) FROM PUBLIC;

-- --------------------------------------------------------------------
-- 3. Record the chosen account on insert
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_entries_record_account_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_account := public.finance_entry_target_account(NEW.vendor_id, NEW.account_id);

  INSERT INTO public.account_transactions (
    vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
  )
  VALUES (
    NEW.vendor_id,
    v_account,
    public.finance_entry_account_amount(NEW.type, NEW.amount),
    CASE WHEN NEW.type = 'expense' THEN 'expense_payment' ELSE 'other_income' END,
    'finance_entry',
    NEW.id,
    NEW.entry_date,
    COALESCE(NULLIF(NEW.notes, ''), NEW.category)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_entries_record_account_movement ON public.finance_entries;
CREATE TRIGGER finance_entries_record_account_movement
  AFTER INSERT ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.finance_entries_record_account_movement();

-- --------------------------------------------------------------------
-- 4. Reverse the old account and post the new one on edit/delete
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finance_entries_reverse_account_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account uuid;
  v_amount numeric;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.deleted_at IS NOT NULL THEN
      RETURN OLD;
    END IF;

    v_account := public.finance_entry_target_account(OLD.vendor_id, OLD.account_id);
    v_amount := -public.finance_entry_account_amount(OLD.type, OLD.amount);

    INSERT INTO public.account_transactions (
      vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
    )
    VALUES (
      OLD.vendor_id, v_account, v_amount, 'reversal', 'finance_entry', OLD.id,
      (now() AT TIME ZONE 'Africa/Kampala')::date, 'Deleted finance entry reversed'
    );
    RETURN OLD;
  END IF;

  -- An edit is a reversal plus a fresh movement. History stays append-only.
  IF OLD.deleted_at IS NULL THEN
    v_account := public.finance_entry_target_account(OLD.vendor_id, OLD.account_id);
    v_amount := -public.finance_entry_account_amount(OLD.type, OLD.amount);

    INSERT INTO public.account_transactions (
      vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
    )
    VALUES (
      OLD.vendor_id, v_account, v_amount, 'reversal', 'finance_entry', OLD.id,
      (now() AT TIME ZONE 'Africa/Kampala')::date, 'Edited finance entry reversed'
    );
  END IF;

  IF NEW.deleted_at IS NULL THEN
    v_account := public.finance_entry_target_account(NEW.vendor_id, NEW.account_id);

    INSERT INTO public.account_transactions (
      vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
    )
    VALUES (
      NEW.vendor_id,
      v_account,
      public.finance_entry_account_amount(NEW.type, NEW.amount),
      CASE WHEN NEW.type = 'expense' THEN 'expense_payment' ELSE 'other_income' END,
      'finance_entry',
      NEW.id,
      NEW.entry_date,
      COALESCE(NULLIF(NEW.notes, ''), NEW.category)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS finance_entries_reverse_account_movement ON public.finance_entries;
CREATE TRIGGER finance_entries_reverse_account_movement
  AFTER UPDATE OR DELETE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.finance_entries_reverse_account_movement();

-- --------------------------------------------------------------------
-- 5. Existing entries keep their current Cash movement
-- --------------------------------------------------------------------
-- The update trigger treats every edit as a reversal plus a fresh movement.
-- Backfilling account_id is not a real money movement, so pause that trigger
-- while existing rows are linked to their current Cash account.
ALTER TABLE public.finance_entries
  DISABLE TRIGGER finance_entries_reverse_account_movement;

UPDATE public.finance_entries f
SET account_id = public.account_for_payment_method(f.vendor_id, 'Cash')
WHERE f.account_id IS NULL;

ALTER TABLE public.finance_entries
  ENABLE TRIGGER finance_entries_reverse_account_movement;

NOTIFY pgrst, 'reload schema';

-- ====================================================================
-- 12. 20261102_05_usability_and_corrections.sql
-- ====================================================================
-- ====================================================================
-- Phase 7: safe transaction correction.
--
-- A stock purchase can be reversed without deleting its history. The
-- purchase row stays (soft deleted), its lines stay, and the account ledger
-- receives a matching refund movement. Stock is reduced and a stock movement
-- is written for every line.
-- ====================================================================

-- Stock movements written by a reversal need their own reason so reports and
-- future audits can tell them apart from manual adjustments.
ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_reason_check;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_reason_check
  CHECK (reason IN ('sale', 'restock', 'adjustment', 'purchase_reversal', 'sale_reversal'));

CREATE OR REPLACE FUNCTION public.reverse_stock_purchase(
  p_vendor_id uuid,
  p_purchase_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  v_purchase public.purchases%ROWTYPE;
  v_item public.purchase_items%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_account public.financial_accounts%ROWTYPE;
  v_refund numeric := 0;
  v_balance_after numeric := NULL;
  v_items_reversed integer := 0;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  IF p_purchase_id IS NULL THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = p_purchase_id AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found. Refresh and try again.';
  END IF;

  IF v_purchase.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This purchase was already reversed.';
  END IF;

  -- Validate every line before changing anything. A purchase whose stock has
  -- already been sold cannot be reversed without making stock negative.
  FOR v_item IN
    SELECT *
    FROM public.purchase_items
    WHERE purchase_id = p_purchase_id AND vendor_id = p_vendor_id
    ORDER BY product_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT * INTO v_product
      FROM public.products
      WHERE id = v_item.product_id AND vendor_id = p_vendor_id
      FOR UPDATE;

      IF FOUND AND COALESCE(v_product.stock, 0) < v_item.quantity THEN
        RAISE EXCEPTION
          'Cannot reverse this purchase because % has already been sold. Adjust stock first.',
          v_product.name;
      END IF;
    END IF;
  END LOOP;

  -- Reverse stock and record the movement for each line.
  FOR v_item IN
    SELECT *
    FROM public.purchase_items
    WHERE purchase_id = p_purchase_id AND vendor_id = p_vendor_id
    ORDER BY product_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT * INTO v_product
      FROM public.products
      WHERE id = v_item.product_id AND vendor_id = p_vendor_id
      FOR UPDATE;

      IF FOUND THEN
        UPDATE public.products
        SET stock = COALESCE(stock, 0) - v_item.quantity,
            updated_at = now()
        WHERE id = v_item.product_id AND vendor_id = p_vendor_id;

        INSERT INTO public.stock_movements (vendor_id, product_id, delta, reason)
        VALUES (p_vendor_id, v_item.product_id, -v_item.quantity, 'purchase_reversal');
      END IF;
    END IF;

    v_items_reversed := v_items_reversed + 1;
  END LOOP;

  -- Refund only money that actually left an account.
  v_refund := ROUND(COALESCE(v_purchase.paid_amount, 0));

  IF v_refund > 0 AND v_purchase.account_id IS NOT NULL THEN
    SELECT * INTO v_account
    FROM public.financial_accounts
    WHERE id = v_purchase.account_id AND vendor_id = p_vendor_id
    FOR UPDATE;

    IF FOUND THEN
      INSERT INTO public.account_transactions (
        vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
      )
      VALUES (
        p_vendor_id,
        v_account.id,
        v_refund,
        'reversal',
        'purchase_reversal',
        p_purchase_id,
        v_today,
        'Reversed stock purchase ' || COALESCE(v_purchase.reference_no, '')
      );

      SELECT v_account.opening_balance + COALESCE(SUM(amount), 0)
      INTO v_balance_after
      FROM public.account_transactions
      WHERE account_id = v_account.id AND vendor_id = p_vendor_id;
    END IF;
  END IF;

  UPDATE public.purchases
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = p_purchase_id AND vendor_id = p_vendor_id;

  RETURN jsonb_build_object(
    'purchase_id', p_purchase_id,
    'reference_no', v_purchase.reference_no,
    'refunded_amount', v_refund,
    'account_name', CASE WHEN v_account.id IS NOT NULL THEN v_account.name ELSE NULL END,
    'account_balance_after', v_balance_after,
    'items_reversed', v_items_reversed
  );
END;
$$;

-- --------------------------------------------------------------------
-- Reverse a sale without erasing it
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_sale(
  p_vendor_id uuid,
  p_sale_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  v_sale public.sales%ROWTYPE;
  v_item public.sale_items%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_tx public.account_transactions%ROWTYPE;
  v_account public.financial_accounts%ROWTYPE;
  v_refund numeric := 0;
  v_balance_after numeric := NULL;
  v_items_reversed integer := 0;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  IF p_sale_id IS NULL THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = p_sale_id AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found. Refresh and try again.';
  END IF;

  IF v_sale.deleted_at IS NOT NULL OR v_sale.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'This sale was already reversed.';
  END IF;

  -- Use the exact money movement created when the sale was recorded. This
  -- keeps partial payments and credit sales correct.
  SELECT * INTO v_tx
  FROM public.account_transactions
  WHERE vendor_id = p_vendor_id
    AND source_type = 'sale'
    AND source_id = p_sale_id
    AND amount > 0
  ORDER BY created_at
  LIMIT 1;

  IF FOUND THEN
    v_refund := v_tx.amount;

    SELECT * INTO v_account
    FROM public.financial_accounts
    WHERE id = v_tx.account_id AND vendor_id = p_vendor_id
    FOR UPDATE;
  END IF;

  -- Put every sold unit back into stock.
  FOR v_item IN
    SELECT *
    FROM public.sale_items
    WHERE sale_id = p_sale_id AND vendor_id = p_vendor_id
    ORDER BY product_id
  LOOP
    IF v_item.product_id IS NOT NULL THEN
      SELECT * INTO v_product
      FROM public.products
      WHERE id = v_item.product_id AND vendor_id = p_vendor_id
      FOR UPDATE;

      IF FOUND THEN
        UPDATE public.products
        SET stock = COALESCE(stock, 0) + v_item.quantity,
            updated_at = now()
        WHERE id = v_item.product_id AND vendor_id = p_vendor_id;

        INSERT INTO public.stock_movements (vendor_id, product_id, delta, reason)
        VALUES (p_vendor_id, v_item.product_id, v_item.quantity, 'sale_reversal');
      END IF;
    END IF;

    v_items_reversed := v_items_reversed + 1;
  END LOOP;

  IF v_refund > 0 AND v_tx.account_id IS NOT NULL THEN
    INSERT INTO public.account_transactions (
      vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
    )
    VALUES (
      p_vendor_id,
      v_tx.account_id,
      -v_refund,
      'reversal',
      'sale_reversal',
      p_sale_id,
      v_today,
      'Reversed sale ' || COALESCE(v_sale.order_no, '')
    );

    SELECT v_account.opening_balance + COALESCE(SUM(amount), 0)
    INTO v_balance_after
    FROM public.account_transactions
    WHERE account_id = v_tx.account_id AND vendor_id = p_vendor_id;
  END IF;

  UPDATE public.sales
  SET status = 'refunded',
      deleted_at = now()
  WHERE id = p_sale_id AND vendor_id = p_vendor_id;

  IF v_sale.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_orders = GREATEST(0, total_orders - 1),
        total_spent = GREATEST(0, total_spent - v_sale.total),
        updated_at = now()
    WHERE id = v_sale.customer_id AND vendor_id = p_vendor_id;
  END IF;

  RETURN jsonb_build_object(
    'sale_id', p_sale_id,
    'order_no', v_sale.order_no,
    'total', v_sale.total,
    'refunded_amount', v_refund,
    'account_name', CASE WHEN v_account.id IS NOT NULL THEN v_account.name ELSE NULL END,
    'account_balance_after', v_balance_after,
    'items_reversed', v_items_reversed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_stock_purchase(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_stock_purchase(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reverse_sale(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_sale(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
-- ====================================================================
-- Phase 11: Settlements and outstanding payments.
--
-- A settlement is the payment of an existing balance. It is NOT a new sale
-- and it is NOT a new stock purchase.
--
-- Customer collections:
--   * increase the selected receiving account
--   * reduce the customer's outstanding sales
--   * never create sales revenue (the sale was already recorded)
--
-- Supplier payments:
--   * reduce the selected paying account
--   * reduce outstanding purchases
--   * never record the stock purchase expense again
--
-- One settlement can be allocated across several outstanding sales or
-- purchases. The idempotency key and unique ledger index make a retried
-- submit return the original payment instead of posting it twice.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Settlement payment header
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlement_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  settlement_type text NOT NULL
    CHECK (settlement_type IN ('customer_collection', 'supplier_payment')),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  supplier_name text,
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE RESTRICT,
  payment_method text,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  reference text,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlement_payments_party_check CHECK (
    (settlement_type = 'customer_collection' AND supplier_name IS NULL)
    OR
    (settlement_type = 'supplier_payment' AND customer_id IS NULL AND supplier_name IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_payments_idempotency
  ON public.settlement_payments (vendor_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_settlement_payments_vendor_date
  ON public.settlement_payments (vendor_id, settlement_type, paid_on DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_settlement_payments_customer
  ON public.settlement_payments (vendor_id, customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settlement_payments_supplier
  ON public.settlement_payments (vendor_id, lower(supplier_name))
  WHERE supplier_name IS NOT NULL;

-- --------------------------------------------------------------------
-- 2. Settlement allocations
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.settlement_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.settlement_payments(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES public.sales(id) ON DELETE RESTRICT,
  purchase_id uuid REFERENCES public.purchases(id) ON DELETE RESTRICT,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlement_allocations_target_check CHECK (
    (sale_id IS NOT NULL AND purchase_id IS NULL)
    OR
    (sale_id IS NULL AND purchase_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_allocations_payment_sale
  ON public.settlement_allocations (payment_id, sale_id)
  WHERE sale_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_settlement_allocations_payment_purchase
  ON public.settlement_allocations (payment_id, purchase_id)
  WHERE purchase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settlement_allocations_sale
  ON public.settlement_allocations (vendor_id, sale_id)
  WHERE sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_settlement_allocations_purchase
  ON public.settlement_allocations (vendor_id, purchase_id)
  WHERE purchase_id IS NOT NULL;

-- One account movement per settlement payment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_account_transactions_settlement
  ON public.account_transactions (vendor_id, source_type, source_id)
  WHERE source_type = 'settlement_payment';

-- Helpful for finding open balances quickly.
CREATE INDEX IF NOT EXISTS idx_sales_vendor_outstanding
  ON public.sales (vendor_id, sale_date)
  WHERE deleted_at IS NULL AND due_amount > 0;

-- --------------------------------------------------------------------
-- 3. Row level security
-- --------------------------------------------------------------------
ALTER TABLE public.settlement_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage settlement payments" ON public.settlement_payments;
CREATE POLICY "Vendors manage settlement payments"
  ON public.settlement_payments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = settlement_payments.vendor_id AND v.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Vendors manage settlement allocations" ON public.settlement_allocations;
CREATE POLICY "Vendors manage settlement allocations"
  ON public.settlement_allocations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = settlement_allocations.vendor_id AND v.user_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------
-- 4. Keep the sale ledger correct when settlements update a sale
-- --------------------------------------------------------------------
-- Settlement payments write their own account movement. The sale trigger
-- must therefore skip updates for a sale that already has settlement
-- allocations, otherwise the money would be counted twice. For ordinary
-- edits it now posts only the change in money received (a delta) instead of
-- the whole paid amount again. Sales that pre-date settlements behave as
-- before.
CREATE OR REPLACE FUNCTION public.sales_record_account_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_amount numeric := 0;
  v_new_amount numeric := 0;
  v_old_account uuid;
  v_new_account uuid;
  v_has_settlement boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.settlement_allocations a WHERE a.sale_id = NEW.id
    ) INTO v_has_settlement;

    IF v_has_settlement THEN
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.deleted_at IS NOT NULL OR NEW.status IN ('cancelled', 'refunded') THEN
    RETURN NEW;
  END IF;

  v_new_amount := CASE
    WHEN NEW.status = 'credit' THEN COALESCE(NEW.paid_amount, 0)
    WHEN COALESCE(NEW.paid_amount, 0) > 0 THEN NEW.paid_amount
    WHEN NEW.status IN ('completed', 'paid') THEN NEW.total
    ELSE COALESCE(NEW.paid_amount, 0)
  END;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(v_new_amount, 0) = 0 THEN
      RETURN NEW;
    END IF;

    v_new_account := public.account_for_payment_method(NEW.vendor_id, NEW.payment_method);

    INSERT INTO public.account_transactions (
      vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
    )
    VALUES (
      NEW.vendor_id, v_new_account, v_new_amount, 'sale_payment', 'sale', NEW.id, NEW.sale_date,
      'Sale ' || COALESCE(NEW.order_no, '')
    );

    RETURN NEW;
  END IF;

  v_old_amount := CASE
    WHEN OLD.status = 'credit' THEN COALESCE(OLD.paid_amount, 0)
    WHEN COALESCE(OLD.paid_amount, 0) > 0 THEN OLD.paid_amount
    WHEN OLD.status IN ('completed', 'paid') THEN OLD.total
    ELSE COALESCE(OLD.paid_amount, 0)
  END;

  v_old_account := public.account_for_payment_method(OLD.vendor_id, OLD.payment_method);

  IF NEW.payment_method IS DISTINCT FROM OLD.payment_method THEN
    v_new_account := public.account_for_payment_method(NEW.vendor_id, NEW.payment_method);

    IF COALESCE(v_old_amount, 0) <> 0 THEN
      INSERT INTO public.account_transactions (
        vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
      )
      VALUES (
        OLD.vendor_id, v_old_account, -v_old_amount, 'reversal', 'sale', OLD.id, OLD.sale_date,
        'Payment method changed for sale ' || COALESCE(OLD.order_no, '')
      );
    END IF;

    IF COALESCE(v_new_amount, 0) <> 0 THEN
      INSERT INTO public.account_transactions (
        vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
      )
      VALUES (
        NEW.vendor_id, v_new_account, v_new_amount, 'sale_payment', 'sale', NEW.id, NEW.sale_date,
        'Payment method changed for sale ' || COALESCE(NEW.order_no, '')
      );
    END IF;

    RETURN NEW;
  END IF;

  IF COALESCE(v_new_amount, 0) <> COALESCE(v_old_amount, 0) THEN
    INSERT INTO public.account_transactions (
      vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
    )
    VALUES (
      NEW.vendor_id,
      v_old_account,
      COALESCE(v_new_amount, 0) - COALESCE(v_old_amount, 0),
      'sale_payment',
      'sale',
      NEW.id,
      NEW.sale_date,
      'Sale ' || COALESCE(NEW.order_no, '')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_record_account_movement ON public.sales;
CREATE TRIGGER sales_record_account_movement
  AFTER INSERT OR UPDATE OF total, paid_amount, status, payment_method, sale_date ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_record_account_movement();

-- --------------------------------------------------------------------
-- 5. Record a customer collection
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_vendor_id uuid,
  p_customer_id uuid,
  p_customer_name text,
  p_allocations jsonb,
  p_payment_method text DEFAULT 'Cash',
  p_account_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_paid_on date DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  v_paid_on date := LEAST(COALESCE(p_paid_on, (now() AT TIME ZONE 'Africa/Kampala')::date), (now() AT TIME ZONE 'Africa/Kampala')::date);
  v_key text := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_allocations jsonb := COALESCE(p_allocations, '[]'::jsonb);
  v_alloc jsonb;
  v_sale public.sales%ROWTYPE;
  v_existing public.settlement_payments%ROWTYPE;
  v_payment public.settlement_payments%ROWTYPE;
  v_account public.financial_accounts%ROWTYPE;
  v_customer_name text := NULLIF(btrim(COALESCE(p_customer_name, '')), '');
  v_total numeric := 0;
  v_amount numeric;
  v_sale_id uuid;
  v_seen uuid[] := '{}';
  v_outstanding numeric;
  v_new_paid numeric;
  v_new_due numeric;
  v_reference text;
  v_balance_after numeric := NULL;
  v_customer_outstanding numeric := 0;
  v_allocations_out jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  IF jsonb_typeof(v_allocations) <> 'array' OR jsonb_array_length(v_allocations) = 0 THEN
    RAISE EXCEPTION 'Select at least one outstanding sale';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT NULLIF(btrim(name), '') INTO v_customer_name
    FROM public.customers
    WHERE id = p_customer_id AND vendor_id = p_vendor_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer not found';
    END IF;
  END IF;

  IF v_customer_name IS NULL THEN
    RAISE EXCEPTION 'Choose the customer making this payment';
  END IF;

  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'Choose the receiving business account';
  END IF;

  SELECT * INTO v_account
  FROM public.financial_accounts
  WHERE id = p_account_id AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receiving account not found';
  END IF;
  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'Choose an active receiving account';
  END IF;

  IF v_key IS NULL THEN
    v_key := gen_random_uuid()::text;
  END IF;

  -- A retried submit returns the original payment without moving money again.
  SELECT * INTO v_existing
  FROM public.settlement_payments
  WHERE vendor_id = p_vendor_id AND idempotency_key = v_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'payment_id', v_existing.id,
      'settlement_type', v_existing.settlement_type,
      'party_name', COALESCE(v_existing.customer_name, v_customer_name),
      'total', v_existing.amount,
      'account_name', v_account.name,
      'account_balance_after', NULL,
      'customer_outstanding_after', NULL,
      'allocations', '[]'::jsonb,
      'duplicate', true
    );
  END IF;

  -- First pass: validate each sale, lock it and sum the allocation amounts.
  FOR v_alloc IN
    SELECT value FROM jsonb_array_elements(v_allocations) ORDER BY value->>'sale_id'
  LOOP
    v_sale_id := NULLIF(v_alloc->>'sale_id', '')::uuid;
    IF v_sale_id IS NULL THEN
      RAISE EXCEPTION 'A settlement line is missing its sale';
    END IF;
    IF v_sale_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'A sale can only appear once in a payment';
    END IF;
    v_seen := array_append(v_seen, v_sale_id);

    v_amount := ROUND(COALESCE((v_alloc->>'amount')::numeric, 0));
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Enter a payment amount greater than zero';
    END IF;

    SELECT * INTO v_sale
    FROM public.sales
    WHERE id = v_sale_id AND vendor_id = p_vendor_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'An outstanding sale in this payment no longer exists';
    END IF;
    IF v_sale.deleted_at IS NOT NULL OR v_sale.status IN ('cancelled', 'refunded') THEN
      RAISE EXCEPTION 'This sale is no longer open for payment';
    END IF;
    IF p_customer_id IS NOT NULL
       AND v_sale.customer_id IS NOT NULL
       AND v_sale.customer_id <> p_customer_id THEN
      RAISE EXCEPTION 'This sale belongs to a different customer';
    END IF;

    v_outstanding := GREATEST(0, ROUND(COALESCE(v_sale.total, 0) - COALESCE(v_sale.paid_amount, 0)));
    IF v_amount > v_outstanding THEN
      RAISE EXCEPTION
        'Payment of UGX % is more than the UGX % still owed on sale %',
        to_char(v_amount, 'FM999G999G999G990'),
        to_char(v_outstanding, 'FM999G999G999G990'),
        COALESCE(v_sale.order_no, '');
    END IF;

    v_total := v_total + v_amount;
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Enter a payment amount greater than zero';
  END IF;

  v_reference := NULLIF(btrim(COALESCE(p_reference, '')), '');
  IF v_reference IS NOT NULL AND char_length(v_reference) > 120 THEN
    RAISE EXCEPTION 'Payment reference must be 120 characters or fewer';
  END IF;

  INSERT INTO public.settlement_payments (
    vendor_id, settlement_type, customer_id, customer_name, account_id,
    payment_method, amount, reference, paid_on, idempotency_key
  )
  VALUES (
    p_vendor_id,
    'customer_collection',
    p_customer_id,
    v_customer_name,
    p_account_id,
    COALESCE(NULLIF(btrim(p_payment_method), ''), 'Cash'),
    v_total,
    v_reference,
    v_paid_on,
    v_key
  )
  ON CONFLICT (vendor_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_payment;

  IF v_payment.id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.settlement_payments
    WHERE vendor_id = p_vendor_id AND idempotency_key = v_key;

    RETURN jsonb_build_object(
      'payment_id', v_existing.id,
      'settlement_type', v_existing.settlement_type,
      'party_name', COALESCE(v_existing.customer_name, v_customer_name),
      'total', v_existing.amount,
      'account_name', v_account.name,
      'account_balance_after', NULL,
      'customer_outstanding_after', NULL,
      'allocations', '[]'::jsonb,
      'duplicate', true
    );
  END IF;

  -- Second pass: write allocations first, then update each sale. The sale
  -- trigger sees the allocation and does not post the money a second time.
  FOR v_alloc IN
    SELECT value FROM jsonb_array_elements(v_allocations) ORDER BY value->>'sale_id'
  LOOP
    v_sale_id := NULLIF(v_alloc->>'sale_id', '')::uuid;
    v_amount := ROUND(COALESCE((v_alloc->>'amount')::numeric, 0));

    SELECT * INTO v_sale
    FROM public.sales
    WHERE id = v_sale_id AND vendor_id = p_vendor_id
    FOR UPDATE;

    INSERT INTO public.settlement_allocations (
      vendor_id, payment_id, sale_id, amount
    )
    VALUES (p_vendor_id, v_payment.id, v_sale_id, v_amount);

    v_new_paid := LEAST(
      COALESCE(v_sale.total, 0),
      COALESCE(v_sale.paid_amount, 0) + v_amount
    );
    v_new_due := GREATEST(0, ROUND(COALESCE(v_sale.total, 0) - v_new_paid));

    UPDATE public.sales
    SET paid_amount = v_new_paid,
        due_amount = v_new_due,
        status = CASE WHEN v_new_due <= 0 THEN 'paid' ELSE 'credit' END,
        updated_at = now()
    WHERE id = v_sale_id AND vendor_id = p_vendor_id;

    v_allocations_out := v_allocations_out || jsonb_build_object(
      'sale_id', v_sale_id,
      'order_no', v_sale.order_no,
      'amount', v_amount,
      'due_after', v_new_due
    );
  END LOOP;

  -- Money received increases the selected account exactly once.
  INSERT INTO public.account_transactions (
    vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
  )
  VALUES (
    p_vendor_id,
    p_account_id,
    v_total,
    'customer_collection',
    'settlement_payment',
    v_payment.id,
    v_paid_on,
    'Customer payment ' || COALESCE(v_reference, v_customer_name)
  );

  SELECT v_account.opening_balance + COALESCE(SUM(amount), 0)
  INTO v_balance_after
  FROM public.account_transactions
  WHERE account_id = p_account_id AND vendor_id = p_vendor_id;

  IF p_customer_id IS NOT NULL THEN
    SELECT COALESCE(SUM(GREATEST(0, total - paid_amount)), 0)
    INTO v_customer_outstanding
    FROM public.sales
    WHERE vendor_id = p_vendor_id
      AND customer_id = p_customer_id
      AND deleted_at IS NULL
      AND status NOT IN ('cancelled', 'refunded');
  ELSE
    SELECT COALESCE(SUM(GREATEST(0, total - paid_amount)), 0)
    INTO v_customer_outstanding
    FROM public.sales
    WHERE vendor_id = p_vendor_id
      AND customer_id IS NULL
      AND lower(btrim(COALESCE(customer_name, ''))) = lower(v_customer_name)
      AND deleted_at IS NULL
      AND status NOT IN ('cancelled', 'refunded');
  END IF;

  IF p_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET due_amount = v_customer_outstanding,
        updated_at = now()
    WHERE id = p_customer_id AND vendor_id = p_vendor_id;
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'settlement_type', 'customer_collection',
    'party_name', v_customer_name,
    'total', v_total,
    'account_name', v_account.name,
    'account_balance_after', v_balance_after,
    'customer_outstanding_after', v_customer_outstanding,
    'allocations', v_allocations_out,
    'duplicate', false
  );
END;
$$;

-- --------------------------------------------------------------------
-- 6. Record a supplier payment
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_supplier_payment(
  p_vendor_id uuid,
  p_supplier_name text,
  p_allocations jsonb,
  p_account_id uuid DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_paid_on date DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Africa/Kampala')::date;
  v_paid_on date := LEAST(COALESCE(p_paid_on, (now() AT TIME ZONE 'Africa/Kampala')::date), (now() AT TIME ZONE 'Africa/Kampala')::date);
  v_key text := NULLIF(btrim(COALESCE(p_idempotency_key, '')), '');
  v_allocations jsonb := COALESCE(p_allocations, '[]'::jsonb);
  v_alloc jsonb;
  v_purchase public.purchases%ROWTYPE;
  v_existing public.settlement_payments%ROWTYPE;
  v_payment public.settlement_payments%ROWTYPE;
  v_account public.financial_accounts%ROWTYPE;
  v_supplier text := NULLIF(btrim(COALESCE(p_supplier_name, '')), '');
  v_total numeric := 0;
  v_amount numeric;
  v_purchase_id uuid;
  v_seen uuid[] := '{}';
  v_outstanding numeric;
  v_new_paid numeric;
  v_new_due numeric;
  v_reference text;
  v_balance_before numeric := 0;
  v_balance_after numeric := NULL;
  v_supplier_outstanding numeric := 0;
  v_allocations_out jsonb := '[]'::jsonb;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  IF jsonb_typeof(v_allocations) <> 'array' OR jsonb_array_length(v_allocations) = 0 THEN
    RAISE EXCEPTION 'Select at least one outstanding purchase';
  END IF;

  IF v_supplier IS NULL THEN
    RAISE EXCEPTION 'Choose the supplier being paid';
  END IF;

  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'Choose the business account used for this payment';
  END IF;

  SELECT * INTO v_account
  FROM public.financial_accounts
  WHERE id = p_account_id AND vendor_id = p_vendor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment account not found';
  END IF;
  IF NOT v_account.is_active THEN
    RAISE EXCEPTION 'Choose an active payment account';
  END IF;

  IF v_key IS NULL THEN
    v_key := gen_random_uuid()::text;
  END IF;

  SELECT * INTO v_existing
  FROM public.settlement_payments
  WHERE vendor_id = p_vendor_id AND idempotency_key = v_key;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'payment_id', v_existing.id,
      'settlement_type', v_existing.settlement_type,
      'party_name', COALESCE(v_existing.supplier_name, v_supplier),
      'total', v_existing.amount,
      'account_name', v_account.name,
      'account_balance_after', NULL,
      'supplier_outstanding_after', NULL,
      'allocations', '[]'::jsonb,
      'duplicate', true
    );
  END IF;

  FOR v_alloc IN
    SELECT value FROM jsonb_array_elements(v_allocations) ORDER BY value->>'purchase_id'
  LOOP
    v_purchase_id := NULLIF(v_alloc->>'purchase_id', '')::uuid;
    IF v_purchase_id IS NULL THEN
      RAISE EXCEPTION 'A settlement line is missing its purchase';
    END IF;
    IF v_purchase_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'A purchase can only appear once in a payment';
    END IF;
    v_seen := array_append(v_seen, v_purchase_id);

    v_amount := ROUND(COALESCE((v_alloc->>'amount')::numeric, 0));
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'Enter a payment amount greater than zero';
    END IF;

    SELECT * INTO v_purchase
    FROM public.purchases
    WHERE id = v_purchase_id AND vendor_id = p_vendor_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'An outstanding purchase in this payment no longer exists';
    END IF;
    IF v_purchase.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'This purchase is no longer open for payment';
    END IF;
    IF lower(btrim(COALESCE(v_purchase.supplier_name, 'Unspecified supplier'))) <> lower(v_supplier) THEN
      RAISE EXCEPTION 'This purchase belongs to a different supplier';
    END IF;

    v_outstanding := GREATEST(0, ROUND(COALESCE(v_purchase.total_amount, 0) - COALESCE(v_purchase.paid_amount, 0)));
    IF v_amount > v_outstanding THEN
      RAISE EXCEPTION
        'Payment of UGX % is more than the UGX % still owed on purchase %',
        to_char(v_amount, 'FM999G999G999G990'),
        to_char(v_outstanding, 'FM999G999G999G990'),
        COALESCE(v_purchase.reference_no, '');
    END IF;

    v_total := v_total + v_amount;
  END LOOP;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Enter a payment amount greater than zero';
  END IF;

  v_reference := NULLIF(btrim(COALESCE(p_reference, '')), '');
  IF v_reference IS NOT NULL AND char_length(v_reference) > 120 THEN
    RAISE EXCEPTION 'Payment reference must be 120 characters or fewer';
  END IF;

  SELECT COALESCE(v_account.opening_balance, 0) + COALESCE(SUM(amount), 0)
  INTO v_balance_before
  FROM public.account_transactions
  WHERE account_id = p_account_id AND vendor_id = p_vendor_id;

  IF v_balance_before < v_total THEN
    RAISE EXCEPTION
      'Not enough money in %. Available: UGX %',
      v_account.name,
      to_char(v_balance_before, 'FM999G999G999G990');
  END IF;

  INSERT INTO public.settlement_payments (
    vendor_id, settlement_type, supplier_name, account_id,
    payment_method, amount, reference, paid_on, idempotency_key
  )
  VALUES (
    p_vendor_id,
    'supplier_payment',
    v_supplier,
    p_account_id,
    NULL,
    v_total,
    v_reference,
    v_paid_on,
    v_key
  )
  ON CONFLICT (vendor_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_payment;

  IF v_payment.id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.settlement_payments
    WHERE vendor_id = p_vendor_id AND idempotency_key = v_key;

    RETURN jsonb_build_object(
      'payment_id', v_existing.id,
      'settlement_type', v_existing.settlement_type,
      'party_name', COALESCE(v_existing.supplier_name, v_supplier),
      'total', v_existing.amount,
      'account_name', v_account.name,
      'account_balance_after', NULL,
      'supplier_outstanding_after', NULL,
      'allocations', '[]'::jsonb,
      'duplicate', true
    );
  END IF;

  FOR v_alloc IN
    SELECT value FROM jsonb_array_elements(v_allocations) ORDER BY value->>'purchase_id'
  LOOP
    v_purchase_id := NULLIF(v_alloc->>'purchase_id', '')::uuid;
    v_amount := ROUND(COALESCE((v_alloc->>'amount')::numeric, 0));

    SELECT * INTO v_purchase
    FROM public.purchases
    WHERE id = v_purchase_id AND vendor_id = p_vendor_id
    FOR UPDATE;

    INSERT INTO public.settlement_allocations (
      vendor_id, payment_id, purchase_id, amount
    )
    VALUES (p_vendor_id, v_payment.id, v_purchase_id, v_amount);

    v_new_paid := LEAST(
      COALESCE(v_purchase.total_amount, 0),
      COALESCE(v_purchase.paid_amount, 0) + v_amount
    );
    v_new_due := GREATEST(0, ROUND(COALESCE(v_purchase.total_amount, 0) - v_new_paid));

    UPDATE public.purchases
    SET paid_amount = v_new_paid,
        due_amount = v_new_due,
        updated_at = now()
    WHERE id = v_purchase_id AND vendor_id = p_vendor_id;

    v_allocations_out := v_allocations_out || jsonb_build_object(
      'purchase_id', v_purchase_id,
      'reference_no', v_purchase.reference_no,
      'amount', v_amount,
      'due_after', v_new_due
    );
  END LOOP;

  -- Money paid leaves the selected account exactly once. No expense entry is
  -- written because the stock purchase was already recorded.
  INSERT INTO public.account_transactions (
    vendor_id, account_id, amount, kind, source_type, source_id, occurred_on, notes
  )
  VALUES (
    p_vendor_id,
    p_account_id,
    -v_total,
    'supplier_payment',
    'settlement_payment',
    v_payment.id,
    v_paid_on,
    'Supplier payment ' || COALESCE(v_reference, v_supplier)
  );

  SELECT v_account.opening_balance + COALESCE(SUM(amount), 0)
  INTO v_balance_after
  FROM public.account_transactions
  WHERE account_id = p_account_id AND vendor_id = p_vendor_id;

  SELECT COALESCE(SUM(GREATEST(0, total_amount - paid_amount)), 0)
  INTO v_supplier_outstanding
  FROM public.purchases
  WHERE vendor_id = p_vendor_id
    AND lower(btrim(COALESCE(supplier_name, 'Unspecified supplier'))) = lower(v_supplier)
    AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'settlement_type', 'supplier_payment',
    'party_name', v_supplier,
    'total', v_total,
    'account_name', v_account.name,
    'account_balance_after', v_balance_after,
    'supplier_outstanding_after', v_supplier_outstanding,
    'allocations', v_allocations_out,
    'duplicate', false
  );
END;
$$;

-- --------------------------------------------------------------------
-- 7. Settlements overview for the screen
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_settlements_overview(
  p_vendor_id uuid,
  p_history_limit integer DEFAULT 300
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_history_limit, 300), 1), 1000);
  v_customer_collections jsonb := '[]'::jsonb;
  v_customer_sales jsonb := '[]'::jsonb;
  v_supplier_payables jsonb := '[]'::jsonb;
  v_supplier_purchases jsonb := '[]'::jsonb;
  v_history jsonb := '[]'::jsonb;
  v_customer_outstanding numeric := 0;
  v_supplier_outstanding numeric := 0;
BEGIN
  PERFORM public.assert_vendor_owner(p_vendor_id);

  WITH open_sales AS (
    SELECT
      s.id,
      s.order_no,
      s.customer_id,
      CASE
        WHEN s.customer_id IS NOT NULL THEN 'id:' || s.customer_id::text
        ELSE 'name:' || lower(btrim(COALESCE(NULLIF(s.customer_name, ''), NULLIF(c.name, ''), 'Walk-in customer')))
      END AS customer_key,
      COALESCE(NULLIF(btrim(s.customer_name), ''), NULLIF(btrim(c.name), ''), 'Walk-in customer') AS customer_name,
      COALESCE(NULLIF(btrim(s.customer_phone), ''), NULLIF(btrim(c.phone), ''), '') AS customer_phone,
      s.sale_date,
      s.total,
      s.paid_amount,
      GREATEST(0, ROUND(COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0))) AS outstanding,
      s.status,
      (
        SELECT MAX(p.paid_on)
        FROM public.settlement_payments p
        WHERE p.vendor_id = p_vendor_id
          AND p.settlement_type = 'customer_collection'
          AND (
            (s.customer_id IS NOT NULL AND p.customer_id = s.customer_id)
            OR (
              s.customer_id IS NULL
              AND lower(btrim(COALESCE(p.customer_name, ''))) =
                lower(btrim(COALESCE(NULLIF(s.customer_name, ''), NULLIF(c.name, ''), 'Walk-in customer')))
            )
          )
      ) AS last_payment_date
    FROM public.sales s
    LEFT JOIN public.customers c ON c.id = s.customer_id AND c.vendor_id = s.vendor_id
    WHERE s.vendor_id = p_vendor_id
      AND s.deleted_at IS NULL
      AND s.status NOT IN ('cancelled', 'refunded')
      AND GREATEST(0, ROUND(COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0))) > 0
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'customer_key', rows.customer_key,
        'customer_id', rows.customer_id,
        'customer_name', rows.customer_name,
        'customer_phone', rows.customer_phone,
        'outstanding', rows.outstanding,
        'sale_count', rows.sale_count,
        'oldest_sale_date', rows.oldest_sale_date,
        'last_payment_date', rows.last_payment_date
      ) ORDER BY rows.outstanding DESC, rows.customer_name
    ),
    '[]'::jsonb
  )
  INTO v_customer_collections
  FROM (
    SELECT
      customer_key,
      (array_agg(customer_id) FILTER (WHERE customer_id IS NOT NULL))[1] AS customer_id,
      MAX(customer_name) AS customer_name,
      MAX(customer_phone) AS customer_phone,
      SUM(outstanding) AS outstanding,
      COUNT(*)::integer AS sale_count,
      MIN(sale_date) AS oldest_sale_date,
      MAX(last_payment_date) AS last_payment_date
    FROM open_sales
    GROUP BY customer_key
  ) rows;

  WITH open_sales AS (
    SELECT
      s.id,
      s.order_no,
      s.customer_id,
      CASE
        WHEN s.customer_id IS NOT NULL THEN 'id:' || s.customer_id::text
        ELSE 'name:' || lower(btrim(COALESCE(NULLIF(s.customer_name, ''), NULLIF(c.name, ''), 'Walk-in customer')))
      END AS customer_key,
      COALESCE(NULLIF(btrim(s.customer_name), ''), NULLIF(btrim(c.name), ''), 'Walk-in customer') AS customer_name,
      COALESCE(NULLIF(btrim(s.customer_phone), ''), NULLIF(btrim(c.phone), ''), '') AS customer_phone,
      s.sale_date,
      s.total,
      s.paid_amount,
      GREATEST(0, ROUND(COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0))) AS outstanding,
      s.status,
      s.created_at
    FROM public.sales s
    LEFT JOIN public.customers c ON c.id = s.customer_id AND c.vendor_id = s.vendor_id
    WHERE s.vendor_id = p_vendor_id
      AND s.deleted_at IS NULL
      AND s.status NOT IN ('cancelled', 'refunded')
      AND GREATEST(0, ROUND(COALESCE(s.total, 0) - COALESCE(s.paid_amount, 0))) > 0
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'order_no', r.order_no,
        'customer_id', r.customer_id,
        'customer_key', r.customer_key,
        'customer_name', r.customer_name,
        'customer_phone', r.customer_phone,
        'sale_date', r.sale_date,
        'total', r.total,
        'paid_amount', r.paid_amount,
        'due_amount', r.outstanding,
        'status', r.status
      ) ORDER BY r.sale_date, r.created_at
    ),
    '[]'::jsonb
  )
  INTO v_customer_sales
  FROM open_sales r;

  WITH open_purchases AS (
    SELECT
      p.id,
      p.reference_no,
      COALESCE(NULLIF(btrim(p.supplier_name), ''), 'Unspecified supplier') AS supplier_name,
      p.purchase_date,
      p.total_amount,
      p.paid_amount,
      GREATEST(0, ROUND(COALESCE(p.total_amount, 0) - COALESCE(p.paid_amount, 0))) AS outstanding,
      p.notes,
      p.created_at,
      (
        SELECT MAX(sp.paid_on)
        FROM public.settlement_payments sp
        WHERE sp.vendor_id = p_vendor_id
          AND sp.settlement_type = 'supplier_payment'
          AND lower(btrim(COALESCE(sp.supplier_name, ''))) =
            lower(btrim(COALESCE(p.supplier_name, 'Unspecified supplier')))
      ) AS last_payment_date
    FROM public.purchases p
    WHERE p.vendor_id = p_vendor_id
      AND p.deleted_at IS NULL
      AND GREATEST(0, ROUND(COALESCE(p.total_amount, 0) - COALESCE(p.paid_amount, 0))) > 0
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'supplier_key', rows.supplier_key,
        'supplier_name', rows.supplier_name,
        'outstanding', rows.outstanding,
        'purchase_count', rows.purchase_count,
        'oldest_purchase_date', rows.oldest_purchase_date,
        'last_payment_date', rows.last_payment_date
      ) ORDER BY rows.outstanding DESC, rows.supplier_name
    ),
    '[]'::jsonb
  )
  INTO v_supplier_payables
  FROM (
    SELECT
      lower(supplier_name) AS supplier_key,
      MIN(supplier_name) AS supplier_name,
      SUM(outstanding) AS outstanding,
      COUNT(*)::integer AS purchase_count,
      MIN(purchase_date) AS oldest_purchase_date,
      MAX(last_payment_date) AS last_payment_date
    FROM open_purchases
    GROUP BY lower(supplier_name)
  ) rows;

  WITH open_purchases AS (
    SELECT
      p.id,
      p.reference_no,
      COALESCE(NULLIF(btrim(p.supplier_name), ''), 'Unspecified supplier') AS supplier_name,
      p.purchase_date,
      p.total_amount,
      p.paid_amount,
      GREATEST(0, ROUND(COALESCE(p.total_amount, 0) - COALESCE(p.paid_amount, 0))) AS outstanding,
      p.notes,
      p.created_at
    FROM public.purchases p
    WHERE p.vendor_id = p_vendor_id
      AND p.deleted_at IS NULL
      AND GREATEST(0, ROUND(COALESCE(p.total_amount, 0) - COALESCE(p.paid_amount, 0))) > 0
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'reference_no', r.reference_no,
        'supplier_key', lower(r.supplier_name),
        'supplier_name', r.supplier_name,
        'purchase_date', r.purchase_date,
        'total_amount', r.total_amount,
        'paid_amount', r.paid_amount,
        'due_amount', r.outstanding,
        'notes', r.notes
      ) ORDER BY r.purchase_date, r.created_at
    ),
    '[]'::jsonb
  )
  INTO v_supplier_purchases
  FROM open_purchases r;

  SELECT COALESCE(SUM(GREATEST(0, total - paid_amount)), 0)
  INTO v_customer_outstanding
  FROM public.sales
  WHERE vendor_id = p_vendor_id
    AND deleted_at IS NULL
    AND status NOT IN ('cancelled', 'refunded');

  SELECT COALESCE(SUM(GREATEST(0, total_amount - paid_amount)), 0)
  INTO v_supplier_outstanding
  FROM public.purchases
  WHERE vendor_id = p_vendor_id AND deleted_at IS NULL;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'settlement_type', h.settlement_type,
        'customer_id', h.customer_id,
        'party_name', h.party_name,
        'amount', h.amount,
        'payment_method', h.payment_method,
        'account_id', h.account_id,
        'account_name', h.account_name,
        'reference', h.reference,
        'paid_on', h.paid_on,
        'created_at', h.created_at,
        'status', 'completed',
        'allocations', h.allocations
      ) ORDER BY h.paid_on DESC, h.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_history
  FROM (
    SELECT
      p.id,
      p.settlement_type,
      p.customer_id,
      COALESCE(p.customer_name, p.supplier_name, c.name, 'Customer') AS party_name,
      p.amount,
      p.payment_method,
      p.account_id,
      a.name AS account_name,
      p.reference,
      p.paid_on,
      p.created_at,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'sale_id', al.sale_id,
            'purchase_id', al.purchase_id,
            'reference_no', COALESCE(s.order_no, pu.reference_no),
            'amount', al.amount
          ) ORDER BY al.created_at
        )
        FROM public.settlement_allocations al
        LEFT JOIN public.sales s ON s.id = al.sale_id
        LEFT JOIN public.purchases pu ON pu.id = al.purchase_id
        WHERE al.payment_id = p.id
      ), '[]'::jsonb) AS allocations
    FROM public.settlement_payments p
    LEFT JOIN public.financial_accounts a ON a.id = p.account_id
    LEFT JOIN public.customers c ON c.id = p.customer_id
    WHERE p.vendor_id = p_vendor_id
    ORDER BY p.paid_on DESC, p.created_at DESC
    LIMIT v_limit
  ) h;

  RETURN jsonb_build_object(
    'customer_collections', v_customer_collections,
    'customer_sales', v_customer_sales,
    'supplier_payables', v_supplier_payables,
    'supplier_purchases', v_supplier_purchases,
    'history', v_history,
    'customer_outstanding', v_customer_outstanding,
    'supplier_outstanding', v_supplier_outstanding
  );
END;
$$;

-- --------------------------------------------------------------------
-- 8. Permissions
-- --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.record_customer_payment(uuid, uuid, text, jsonb, text, uuid, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(uuid, uuid, text, jsonb, text, uuid, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.record_supplier_payment(uuid, text, jsonb, uuid, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_supplier_payment(uuid, text, jsonb, uuid, text, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.vendor_settlements_overview(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_settlements_overview(uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
