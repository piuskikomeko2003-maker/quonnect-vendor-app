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
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const user = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
  };
  const profileUser = { ...user, user_metadata: claims.user_metadata };

  // One round trip: read the stall and its vendor together. This runs on every
  // page render, so avoiding a second sequential query matters for tab speed.
  const { data: joined } = await supabase
    .from("stalls")
    .select<string, Stall & { vendors: Vendor }>("*, vendors!inner(*)")
    .eq("vendors.user_id", user.id)
    .maybeSingle();

  if (joined) {
    const { vendors, ...stall } = joined;
    return { supabase, user, vendor: vendors, stall: stall as Stall };
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  let activeVendor = vendor;
  let activeStall: Stall | null = null;

  if (!activeVendor) {
    const repaired = await ensureVendorProfile(supabase, profileUser);
    activeVendor = repaired.vendor;
    activeStall = repaired.stall;
  }

  if (!activeVendor) return null;

  if (!activeStall) {
    const repaired = await ensureVendorProfile(supabase, profileUser);
    activeStall = repaired.stall;
  }

  return {
    supabase,
    user,
    vendor: activeVendor,
    stall: activeStall ?? FALLBACK_STALL(activeVendor),
  };
});

export async function requireVendor(): Promise<VendorContext> {
  const context = await getVendorContext();
  if (!context) redirect("/setup");
  return context;
}
