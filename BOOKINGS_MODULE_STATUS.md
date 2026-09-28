# Bookings & Customer Orders Module — Status & Schema

## 1. Overview
The Bookings & Orders module enables vendors to manage incoming customer appointments, pre-orders, and stall pickups. It links directly with their products catalog and provides automated integration with the Financial Tracking module (auto-recording completed orders into `finance_entries` with `source = 'auto_order'`).

---

## 2. Current Status
- **Phase**: Tables Migrated & Bookings UI Built ✅
- **Supabase Project**: `quonnect-vendor-app` (`akfktjvckvlfclkwjppn`)
- **Database Tables**:
  - `public.bookings`: Created with RLS, check constraints, foreign keys to `vendors(id)` and `products(id)`, and performance indexes.
- **TypeScript Types**: Updated in `src/types/database.types.ts` (`Booking`, `BookingInsert`, `BookingUpdate`).
- **Dashboard UI**: Fully implemented at `/bookings` with White & Teal design, status workflow buttons, WhatsApp/call links, and financial auto-order sync.

---

## 3. Database Schema in Supabase

### Table: `public.bookings`
```sql
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    service_or_product TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total_price NUMERIC(14, 2) NOT NULL CHECK (total_price >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
    booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
    booking_time TEXT,
    delivery_location TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bookings_vendor_id 
    ON public.bookings (vendor_id);

CREATE INDEX idx_bookings_vendor_status 
    ON public.bookings (vendor_id, status);

CREATE INDEX idx_bookings_vendor_date 
    ON public.bookings (vendor_id, booking_date DESC);
```

### Row Level Security (RLS) Policies
- **Vendor Management**: Authenticated vendors have full CRUD access over their own bookings (`vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())`).
- **Public Customers**: Anonymous and authenticated customers can insert new bookings/orders (`FOR INSERT WITH CHECK (true)`).

---

## 4. Components & Pages Built

1. **Bookings Overview Page (`src/app/bookings/page.tsx`)**:
   - Hero banner with `Customer Bookings & Pre-orders.png` background image and dark gradient overlay (`from-slate-950/90 via-slate-950/75 to-slate-900/65`) for contrast, matching the Stall & Products hero banner styling.
   - Status KPI cards: Total Orders, Action Required (Pending), Scheduled (Confirmed), and Fulfilled Value (UGX).
   - Filter tabs (`All`, `Pending`, `Confirmed`, `Completed`).
   - Customer and service text search.
   - Responsive grid of booking cards with empty state guidance.

2. **Booking Card Component (`src/components/bookings/BookingCard.tsx`)**:
   - Customer identity with direct call link (`tel:`) and WhatsApp chat link (`wa.me`).
   - Order items, quantity, and formatted total in UGX.
   - Scheduled date, time slot, and delivery/pickup location badges.
   - Status badge and action buttons:
     - "Confirm Order" (transitions from pending to confirmed).
     - "Complete & Record Income" (marks order completed and writes an auto-entry into `finance_entries` with `source = 'auto_order'`).
     - "Cancel Order" and "Delete".

3. **New Booking Modal (`src/components/bookings/NewBookingModal.tsx`)**:
   - Customer Name, Phone, and Email inputs.
   - Product selector linked to live stall products (automatically computes total from quantity × product price) or custom service entry.
   - Scheduled date and time picker.
   - Delivery or stall pickup address.

4. **Integrated Top Navigation (`src/components/layout/Navbar.tsx`)**:
   - Navigation links across **Financial Tracking**, **Stall & Products**, and **Bookings & Orders**.

---

## 5. What's Next
- [ ] User review and verification of the Bookings & Orders module.
- [ ] Final core module: **Customer Messaging** (inbox / direct vendor-customer chats).
