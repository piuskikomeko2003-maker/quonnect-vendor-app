-- ====================================================================
-- Money management: choose the account behind an expense or other income.
--
-- Until now every finance entry posted to the generic Cash account. This
-- migration lets the vendor pick the actual payment or receiving account and
-- keeps the append-only account movement history in sync.
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
