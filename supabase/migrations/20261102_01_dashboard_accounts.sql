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
