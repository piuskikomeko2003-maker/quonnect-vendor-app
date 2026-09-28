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
