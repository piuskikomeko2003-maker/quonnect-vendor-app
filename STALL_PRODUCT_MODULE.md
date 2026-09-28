# Stall / Product Management Module

## Overview
Lets a vendor build and manage their online stall — the product catalog that powers their public presence on the Quonnect marketplace. Built after the Financial module; the marketplace itself (public browsing) is a later, separate module that reads from this data.

## Stack
- Next.js (App Router, TypeScript), client-side Supabase calls (static-export/Capacitor-ready)
- Supabase Storage for product/business images
- Tailwind CSS, mobile-first

## Database Schema

### `products`
| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| vendor_id | uuid | references vendors.id |
| name | text | |
| description | text | nullable |
| price | numeric | |
| photo_url | text | Supabase Storage URL |
| stock | integer | nullable if not stock-tracked |
| is_active | boolean | default false; controls marketplace visibility |
| created_at | timestamptz | default now() |

## RLS Policies
- Vendor: full select/insert/update/delete on `products` where `vendor_id` matches their own vendor row
- Public (future marketplace module): read-only on `products` where `is_active = true`, joined to `vendors`

## Storage
- Bucket: `vendor-assets`
- Path convention: `vendor-assets/{vendor_id}/products/{product_id}.jpg`

## Pages / Components
1. **Stall overview** (`/dashboard/stall`) — grid/list of vendor's products, active/inactive status visible
2. **Add/edit product form** — name, description, price, stock, photo upload, active toggle
3. **Product image upload** — Supabase Storage upload with retry logic (accounts for weak connectivity)
4. **Delete/deactivate product** — soft-deactivate via `is_active = false` preferred over hard delete

## UX Constraints
- Mobile-first, optimized for low-end Android + patchy data
- Image upload must handle retries/failures gracefully (don't lose form data on failed upload)
- Currency: UGX, thousands separators

## Relationship to Marketplace (future module)
The public marketplace is a read-only filtered view over `products` + `vendors` where `is_active = true` — no separate marketplace database. This module just needs to get vendor-side catalog management fully working first.

## Out of Scope (this module)
Public marketplace browsing/search, bookings, messaging, payments.

## Status
- [ ] Table + RLS migrated
- [ ] Storage bucket created
- [ ] Stall overview page built
- [ ] Add/edit product form built
- [ ] Image upload with retry built
