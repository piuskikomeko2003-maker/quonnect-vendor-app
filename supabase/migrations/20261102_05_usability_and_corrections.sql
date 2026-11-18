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
