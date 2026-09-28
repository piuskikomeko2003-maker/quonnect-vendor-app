# Financial Tracking Module — Status & Schema

## 1. Overview
The Financial Tracking module enables vendors to record daily income and expenses, review cash flow, track category breakdown, and monitor business growth and net balances over time. It is designed mobile-first for fast transaction entry, with amounts formatted in UGX.

---

## 2. Current Status
- **Phase**: Tables Migrated & Dashboard UI Built ✅
- **Supabase Project**: `quonnect-vendor-app` (`akfktjvckvlfclkwjppn`)
- **Database Tables**:
  - `public.vendors`: Created with RLS and foreign key to `auth.users(id)`
  - `public.finance_entries`: Created with RLS, check constraints, and composite indexes
- **TypeScript Types**: Generated from Supabase schema and integrated (`src/types/database.types.ts`)
- **Dashboard UI**: Fully implemented and tested with Next.js App Router, Tailwind CSS, and Lucide icons.

---

## 3. Database Schema in Supabase

### Table: `public.vendors`
Stores the vendor profile linked to a Supabase auth user.
```sql
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    category TEXT,
    region TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Table: `public.finance_entries`
Stores all financial transactions (income & expenses) for each vendor.
```sql
CREATE TABLE IF NOT EXISTS public.finance_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_order')),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Indexes & Performance
```sql
CREATE INDEX idx_finance_entries_vendor_date 
    ON public.finance_entries (vendor_id, entry_date DESC);

CREATE INDEX idx_finance_entries_vendor_type 
    ON public.finance_entries (vendor_id, type);
```

### Row Level Security (RLS)
- `vendors`: Users can select, insert, and update their own vendor profile (`auth.uid() = user_id`).
- `finance_entries`: Vendors can select, insert, update, and delete only records where `vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())`.

---

## 4. Components & Pages Built

1. **Dashboard Overview (`src/app/page.tsx`)**:
   - Hero banner with `Financial Health & Cashflow.png` background image and dark gradient overlay (`from-slate-950/90 via-slate-950/75 to-slate-900/65`) for optimal contrast and readability, consistent with Stall and Bookings hero headers.
   - Vendor badges with frosted glass backdrop blur, business name, category, and region.
   - Glassmorphism period toggle: "This Month" vs "All Time".
   - Seamless data sync with Supabase and demo mode fallback.

2. **Summary KPI Cards (`src/components/finance/SummaryCards.tsx`)**:
   - Total Income card with inflow indicator.
   - Total Expenses card with percentage-of-revenue calculation.
   - Net Balance card with margin badge and dynamic profit/deficit styling.

3. **Cashflow & Growth Chart (`src/components/finance/GrowthChart.tsx`)**:
   - Interactive 6-month visual breakdown of monthly income vs expenses.
   - Month selection to view exact figures in UGX.
   - Trend tracking for business growth over time.

4. **Add Transaction Modal (`src/components/finance/AddTransactionModal.tsx`)**:
   - Mobile-first quick entry dialog.
   - Type switcher (`+ Income` / `− Expense`).
   - Large numeric amount input with live UGX formatting and quick increment chips (`+10k`, `+50k`, `+100k`, `+500k`).
   - Category chips (presets + custom category input).
   - Date picker and optional memo notes.
   - Direct persistence to `finance_entries` in Supabase.

5. **Transactions Ledger (`src/components/finance/TransactionsList.tsx`)**:
   - Filter chips (All, Income, Expense).
   - Real-time search across categories and notes.
   - Date timeframe filter (All Dates, This Month, Last Month).
   - Responsive design: compact card view on mobile, detailed data table on desktop.
   - Delete action with confirmation.

6. **Authentication Page (`src/app/login/page.tsx`)**:
   - Sign in and Vendor Registration tabs.
   - Creates `vendors` profile linked to Supabase Auth on signup.
   - Instant Demo Mode button for immediate UI inspection.

---

## 5. What's Next
- [ ] User review and verification of the Financial Tracking dashboard.
- [ ] Next module: Login/Auth refinements or Stall & Product Management Module (`STALL_PRODUCT_MODULE.md`).
