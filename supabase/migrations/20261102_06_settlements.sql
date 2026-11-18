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
