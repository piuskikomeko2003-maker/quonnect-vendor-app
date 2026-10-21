import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureVendorProfile } from "@/lib/vendor";
import type { Stall, Vendor } from "@/types/app-db";

export interface VendorContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string | null };
  vendor: Vendor;
  stall: Stall;
}

const FALLBACK_STALL = (vendor: Vendor): Stall => ({
  id: "fallback",
  vendor_id: vendor.id,
  name: vendor.business_name,
  tagline: vendor.motto ?? "",
  accent_color: "#0F8A4D",
  created_at: vendor.created_at,
  updated_at: vendor.updated_at,
});

export const getVendorContext = cache(async (): Promise<VendorContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: vendor, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  let activeVendor = vendor;
  let activeStall: Stall | null = null;

  if (!activeVendor || error) {
    const repaired = await ensureVendorProfile(supabase, user);
    activeVendor = repaired.vendor;
    activeStall = repaired.stall;
  }

  if (!activeVendor) return null;

  if (!activeStall) {
    const { data: stall } = await supabase
      .from("stalls")
      .select("*")
      .eq("vendor_id", activeVendor.id)
      .maybeSingle();
    activeStall = stall;

    if (!activeStall) {
      const repaired = await ensureVendorProfile(supabase, user);
      activeStall = repaired.stall;
    }
  }

  return {
    supabase,
    user: { id: user.id, email: user.email },
    vendor: activeVendor,
    stall: activeStall ?? FALLBACK_STALL(activeVendor),
  };
});

export async function requireVendor(): Promise<VendorContext> {
  const context = await getVendorContext();
  if (!context) redirect("/setup");
  return context;
}
