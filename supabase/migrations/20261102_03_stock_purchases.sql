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
