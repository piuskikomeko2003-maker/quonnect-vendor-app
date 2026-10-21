# Login / Auth Module

## Overview
Handles vendor (and later customer) identity for the Quonnect Vendor App. Self-service signup/login — distinct from the Quonnect Data System's admin link-code model.

## Stack
- Supabase Auth
- Next.js (App Router, TypeScript), client-side auth calls only (static-export/Capacitor-ready)

## Decisions Needed
- [ ] Phone/OTP vs email/password as primary login method (phone/OTP likely better fit — needs an SMS provider, e.g. Twilio, configured in Supabase Auth settings)
- [ ] Whether customers get full accounts now or remain guest + phone number for the first version

## Roles
- `vendor` — full access to their own business management + stall data
- `customer` — browse marketplace, place bookings/orders, message vendors (lighter account, possibly guest-based initially)
- `admin` — Quonnect team, cross-vendor visibility (not built in this phase)

## Database

### `vendors`
See Financial Module doc — `vendors.user_id` links to `auth.users`.

### `customers` (optional / later)
| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| user_id | uuid | references auth.users, nullable if guest model used |
| name | text | |
| phone | text | |

## Flows
1. **Vendor signup** — collects business_name, category, region, phone at minimum; creates `vendors` row linked to new auth user
2. **Vendor login** — standard Supabase Auth session; auth guard on all dashboard routes checks session + loads vendor row
3. **Session handling** — Supabase client session persistence; protected layout redirects unauthenticated users to `/login`
4. **Password/OTP reset** — via Supabase Auth built-in flows

## RLS Implications
- All vendor-owned tables (`finance_entries`, `products`, `orders`, `messages`) key off `vendor_id`, which traces back to `auth.uid()` via `vendors.user_id` — auth is the root of every RLS policy in the system

## Out of Scope (this module)
Admin role/dashboard, customer full accounts (until decided above), social login.

## Status
- [ ] Supabase project created
- [ ] Auth method decided (phone/email)
- [ ] SMS provider configured (if phone/OTP)
- [ ] Signup flow built
- [ ] Login flow built
- [ ] Auth guard / protected layout built
