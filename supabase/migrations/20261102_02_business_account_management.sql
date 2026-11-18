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
