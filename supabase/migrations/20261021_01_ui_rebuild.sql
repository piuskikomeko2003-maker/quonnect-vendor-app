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
