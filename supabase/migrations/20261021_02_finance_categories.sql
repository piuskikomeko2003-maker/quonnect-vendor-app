-- ====================================================================
-- Money: custom expense/income categories and daily/monthly expenses.
-- Safe to re-run.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Expense frequency
-- --------------------------------------------------------------------
ALTER TABLE public.finance_entries
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_entries_frequency_check'
  ) THEN
    ALTER TABLE public.finance_entries
      ADD CONSTRAINT finance_entries_frequency_check
      CHECK (frequency IN ('daily', 'monthly'));
  END IF;
END $$;

-- --------------------------------------------------------------------
-- 2. Per-vendor custom categories
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, type, name)
);

ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendors manage finance categories" ON public.finance_categories;
CREATE POLICY "Vendors manage finance categories" ON public.finance_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = finance_categories.vendor_id AND v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = finance_categories.vendor_id AND v.user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
