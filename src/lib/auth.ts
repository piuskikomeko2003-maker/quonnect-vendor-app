import { createClient } from "@/lib/supabase/browser";
import { getSessionOnce } from "@/lib/auth-session";
import { ensureVendorProfile } from "@/lib/vendor";
import { normalizeAccent } from "@/lib/constants";
import type { Stall, Vendor } from "@/types/app-db";

export interface VendorContext {
  supabase: ReturnType<typeof createClient>;
  user: { id: string; email?: string | null };
  vendor: Vendor;
  stall: Stall;
}

const FALLBACK_STALL = (vendor: Vendor): Stall => ({
  id: "fallback",
  vendor_id: vendor.id,
  name: vendor.business_name,
  tagline: vendor.motto ?? "",
  accent_color: "#1D4ED8",
  created_at: vendor.created_at,
  updated_at: vendor.updated_at,
});

/**
 * Loads the signed-in vendor and stall from the browser client. Pages run
 * inside VendorProvider, which redirects to /login or /setup when this returns
 * null, so no server-side middleware is needed.
 */
export async function getVendorContext(): Promise<VendorContext | null> {
  const supabase = createClient();
  const session = await getSessionOnce();
  const authUser = session?.user;
  if (!authUser) return null;

  const user = { id: authUser.id, email: authUser.email };

  // One round trip: read the stall and its vendor together.
  const { data: joined } = await supabase
    .from("stalls")
    .select<string, Stall & { vendors: Vendor }>("*, vendors!inner(*)")
    .eq("vendors.user_id", user.id)
    .maybeSingle();

  if (joined) {
    const { vendors, ...stall } = joined;
    return {
      supabase,
      user,
      vendor: vendors,
      stall: { ...(stall as Stall), accent_color: normalizeAccent((stall as Stall).accent_color) },
    };
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  let activeVendor = vendor;
  let activeStall: Stall | null = null;

  if (!activeVendor) {
    const repaired = await ensureVendorProfile(supabase, authUser);
    activeVendor = repaired.vendor;
    activeStall = repaired.stall;
  }

  if (!activeVendor) return null;

  if (!activeStall) {
    const repaired = await ensureVendorProfile(supabase, authUser);
    activeStall = repaired.stall;
  }

  return {
    supabase,
    user,
    vendor: activeVendor,
    stall: activeStall
      ? { ...activeStall, accent_color: normalizeAccent(activeStall.accent_color) }
      : FALLBACK_STALL(activeVendor),
  };
}

/** Used by mutations: the pages already guarantee a vendor context exists. */
export async function requireVendor(): Promise<VendorContext> {
  const context = await getVendorContext();
  if (!context) throw new Error("Your session has expired. Please log in again.");
  return context;
}
