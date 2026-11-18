import type { ReceiptBusiness } from "@/lib/receipt";
import { normalizeAccent } from "@/lib/constants";
import type { Stall, Vendor } from "@/types/app-db";

export function receiptBusiness(vendor: Vendor, stall: Stall): ReceiptBusiness {
  return {
    stallName: stall.name || vendor.business_name,
    tagline: stall.tagline || vendor.motto || "",
    businessName: vendor.business_name,
    category: vendor.category ?? "",
    location: vendor.region ?? "",
    phone: vendor.phone ?? "",
    logoUrl: vendor.logo_url,
    accent: normalizeAccent(stall.accent_color),
    instagram: vendor.instagram ?? "",
    facebook: vendor.facebook ?? "",
    tiktok: vendor.tiktok ?? "",
    whatsapp: vendor.whatsapp ?? "",
  };
}
