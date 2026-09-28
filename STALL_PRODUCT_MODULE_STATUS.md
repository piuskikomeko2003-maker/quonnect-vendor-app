# Stall / Product Management Module — Status & Schema

## 1. Overview
The Stall / Product Management module allows a vendor to build, edit, and organize their digital product catalog and inventory. It manages product pricing in UGX, descriptions, stock counts, photo uploads via Supabase Storage, and visibility controls (`is_active` toggle) that determine public display on the future Quonnect marketplace.

---

## 2. Current Status
- **Phase**: Tables Migrated, Storage Configured & Stall UI Built ✅
- **Supabase Project**: `quonnect-vendor-app` (`akfktjvckvlfclkwjppn`)
- **Database Tables**:
  - `public.products`: Created with RLS, check constraints, foreign keys, and indexes.
- **Storage Bucket**:
  - `vendor-assets`: Created as a public bucket with storage RLS policies for CDN image delivery.
- **TypeScript Types**: Updated in `src/types/database.types.ts` (`Product`, `ProductInsert`, `ProductUpdate`).
- **Dashboard UI**: Fully implemented at `/stall` with catalog cards, stats row, add/edit modal, image retry logic, and marketplace toggle.

---

## 3. Database Schema in Supabase

### Table: `public.products`
```sql
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
    photo_url TEXT,
    stock INTEGER CHECK (stock IS NULL OR stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance Indexes
CREATE INDEX idx_products_vendor_id 
    ON public.products (vendor_id);

CREATE INDEX idx_products_active_vendor 
    ON public.products (is_active, vendor_id);
```

### Row Level Security (RLS) Policies
- **Vendor Management**: Vendors can create, view, update, and delete only their own products (`vendor_id IN (SELECT id FROM public.vendors WHERE user_id = auth.uid())`).
- **Public Marketplace Read**: Anyone can read active marketplace products (`is_active = true`).

### Supabase Storage
- Bucket: `vendor-assets` (Public bucket)
- Organization: `vendor-assets/{vendor_id}/products/{product_id}.jpg`
- Policies: Public `SELECT` enabled; authenticated insert/update/delete scoped to bucket.

---

## 4. Components & Pages Built

1. **Stall & Catalog Page (`src/app/stall/page.tsx`)**:
   - Vendor stall header banner with business name, category, and region.
   - Catalog stats row: Total Products, Active on Marketplace, Drafts / Hidden, and Low/Out-of-Stock alert counter.
   - Search bar and filtering tabs (`All`, `Active`, `Drafts`, `Low Stock`).
   - Dynamic product cards grid.
   - Empty state guidance with instant "+ Add Product" trigger.

2. **Product Card Component (`src/components/stall/ProductCard.tsx`)**:
   - Product photo thumbnail with placeholder fallback.
   - Marketplace status indicator badge (`On Marketplace` / `Hidden`).
   - Stock level badge (`Out of Stock`, `Low Stock`, or count).
   - Formatted UGX price.
   - Quick one-tap visibility toggle (`is_active`).
   - Edit and delete actions.

3. **Add & Edit Product Modal (`src/components/stall/AddEditProductModal.tsx`)**:
   - Product title, description, and price (UGX).
   - Optional inventory stock tracking toggle and quantity input.
   - Immediate "Show on Marketplace" visibility switch.
   - Camera/file picker with preview.
   - Integration with Supabase Storage via `uploadProductPhotoWithRetry`.

4. **Resilient Storage Upload Utility (`src/lib/storage.ts`)**:
   - `uploadProductPhotoWithRetry`: Automatic retry with exponential backoff for weak or intermittent mobile data connections.
   - Handles graceful fallback without data loss.

5. **Integrated Navigation (`src/components/layout/Navbar.tsx`)**:
   - Module switcher tabs (`Financial Tracking` and `Stall & Products`) with active route highlighting.

---

## 5. What's Next
- [ ] User review and verification of the Stall & Product Management module.
- [ ] Next module: Login/Auth refinements or Bookings / Customer Orders module.
