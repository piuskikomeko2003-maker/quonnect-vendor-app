# Financial Tracking Module

## Overview
Lets a vendor log expenses and income, and view an auto-calculated business growth/balance over time. First module of the Quonnect Vendor App — built standalone, no dependency on stall/marketplace/bookings modules.

## Stack
- Next.js (App Router, TypeScript) — static-export compatible, no API routes/server actions
- Supabase (Auth, Postgres, RLS) — all data access via Supabase client directly
- Tailwind CSS, mobile-first
- Project: separate Supabase project (`quonnect-vendor-app`), distinct from the Quonnect Data System

## Database Schema

### `vendors`
| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | default gen_random_uuid() |
| user_id | uuid | references auth.users, unique |
| business_name | text | |
| category | text | |
| region | text | |
| phone | text | |
| created_at | timestamptz | default now() |

### `finance_entries`
| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| vendor_id | uuid | references vendors.id |
| type | text | check in ('expense','income') |
| category | text | e.g. transport, stock, rent, sales, other |
| amount | numeric | |
| source | text | default 'manual'; later 'auto_order' |
| entry_date | date | default current_date |
| notes | text | nullable |
| created_at | timestamptz | default now() |

## RLS Policies
- `finance_entries`: vendor can select/insert/update/delete only rows where `vendor_id` matches their own vendor row (`auth.uid() = vendors.user_id`)
- `vendors`: vendor can read/update only their own row

## Pages / Components
1. **Auth guard / protected layout** — redirects to login if no session; loads vendor's own `vendors` row
2. **Dashboard overview** (`/dashboard`)
   - Summary cards: Total Income, Total Expenses, Net Balance (all-time / this-month toggle)
   - Income vs expenses chart, last 6 months
3. **Add entry form** — type toggle, category (dropdown + custom), amount, date, notes → inserts into `finance_entries`
4. **Entries list/table** — paginated, filterable by type/date range, editable/deletable
5. **Growth view** — monthly net balance trend (income − expenses per month)

## UX Constraints
- Mobile-first, large tap targets, fast entry flow (used frequently, on the go)
- Currency: UGX, formatted with thousands separators

## Out of Scope (this module)
Products/stall management, marketplace, bookings, messaging, payments integration.

## Status
- [ ] Supabase project created
- [ ] Tables + RLS migrated
- [ ] Auth guard built
- [ ] Add entry flow built
- [ ] Dashboard + chart built
- [ ] Entries list built
