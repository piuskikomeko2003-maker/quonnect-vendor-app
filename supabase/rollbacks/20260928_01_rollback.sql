-- ====================================================================
-- Rollback Migration for 20260928_01_core_and_modular_schema.sql
-- ====================================================================

DROP TABLE IF EXISTS public.stock_transfers CASCADE;
DROP TABLE IF EXISTS public.stock_levels CASCADE;
DROP TABLE IF EXISTS public.stores CASCADE;
DROP TABLE IF EXISTS public.shop_members CASCADE;
DROP TABLE IF EXISTS public.activity_log CASCADE;
DROP TABLE IF EXISTS public.quotations CASCADE;
DROP TABLE IF EXISTS public.damaged_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.purchase_items CASCADE;
DROP TABLE IF EXISTS public.purchases CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.shop_suggestions CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.sale_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.product_images CASCADE;

-- Revert columns added to public.vendors
ALTER TABLE public.vendors
  DROP COLUMN IF EXISTS features_enabled,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS logo_url,
  DROP COLUMN IF EXISTS signature_url,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS owner_name,
  DROP COLUMN IF EXISTS deleted_at;

-- Revert columns added to public.products
ALTER TABLE public.products
  DROP COLUMN IF EXISTS cost,
  DROP COLUMN IF EXISTS is_service,
  DROP COLUMN IF EXISTS min_stock_alert,
  DROP COLUMN IF EXISTS sku,
  DROP COLUMN IF EXISTS barcode,
  DROP COLUMN IF EXISTS expiry_date,
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS quantity_unit,
  DROP COLUMN IF EXISTS is_sample,
  DROP COLUMN IF EXISTS deleted_at;

-- Revert columns added to public.finance_entries
ALTER TABLE public.finance_entries
  DROP COLUMN IF EXISTS receipt_url,
  DROP COLUMN IF EXISTS is_sample,
  DROP COLUMN IF EXISTS deleted_at;
