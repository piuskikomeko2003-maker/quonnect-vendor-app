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
