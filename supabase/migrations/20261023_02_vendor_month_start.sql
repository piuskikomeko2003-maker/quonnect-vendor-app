-- ====================================================================
-- Vendor profit-month setting: the day of the month a business month
-- starts on (e.g. 25 = 25 Jun → 24 Jul). Safe to re-run.
-- ====================================================================

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS month_start_day smallint NOT NULL DEFAULT 1;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_month_start_day_check;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_month_start_day_check
  CHECK (month_start_day BETWEEN 1 AND 28);

NOTIFY pgrst, 'reload schema';
