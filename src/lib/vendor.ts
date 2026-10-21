import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppDatabase, Stall, Vendor } from "@/types/app-db";

type Client = SupabaseClient<AppDatabase>;

/** The subset of a signed-in user needed to repair a profile. */
export interface ProfileUser {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}

interface SignupMetadata {
  owner_name?: string;
  business_name?: string;
  category?: string;
  region?: string;
  phone?: string;
  motto?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  whatsapp?: string;
  logo_url?: string;
}

function metadataOf(user: ProfileUser): SignupMetadata {
  return (user.user_metadata ?? {}) as SignupMetadata;
}

/**
 * Makes sure a signed-in auth user has a vendor profile and a stall.
 * This covers the window where email confirmation means the signup action
 * could not write rows, and also repairs older trigger-created vendors.
 */
export async function ensureVendorProfile(
  supabase: Client,
  user: ProfileUser,
): Promise<{ vendor: Vendor | null; stall: Stall | null; error?: string }> {
  const meta = metadataOf(user);

  const { data: existing } = await supabase
    .from("vendors")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  let vendor = existing;

  const profileFields = {
    owner_name: meta.owner_name ?? existing?.owner_name ?? null,
    business_name: meta.business_name ?? existing?.business_name ?? "My Stall",
    category: meta.category ?? existing?.category ?? null,
    region: meta.region ?? existing?.region ?? null,
    phone: meta.phone ?? existing?.phone ?? null,
    email: user.email ?? existing?.email ?? null,
    motto: meta.motto ?? existing?.motto ?? null,
    instagram: meta.instagram ?? existing?.instagram ?? null,
    facebook: meta.facebook ?? existing?.facebook ?? null,
    tiktok: meta.tiktok ?? existing?.tiktok ?? null,
    whatsapp: meta.whatsapp ?? existing?.whatsapp ?? null,
    logo_url: meta.logo_url ?? existing?.logo_url ?? null,
    updated_at: new Date().toISOString(),
  };

  if (!vendor) {
    const { data, error } = await supabase
      .from("vendors")
      .insert({ user_id: user.id, ...profileFields })
      .select("*")
      .single();
    if (error) {
      console.error("Could not create vendor profile:", error.message);
      return { vendor: null, stall: null, error: error.message };
    }
    vendor = data;
  } else if (!vendor.owner_name && meta.owner_name) {
    const { data } = await supabase
      .from("vendors")
      .update(profileFields)
      .eq("id", vendor.id)
      .select("*")
      .single();
    vendor = data ?? vendor;
  }

  const { data: stall } = await supabase
    .from("stalls")
    .select("*")
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  let activeStall = stall;
  if (!activeStall) {
    const { data } = await supabase
      .from("stalls")
      .insert({
        vendor_id: vendor.id,
        name: profileFields.business_name,
        tagline: profileFields.motto ?? "",
        accent_color: "#0F8A4D",
      })
      .select("*")
      .single();
    activeStall = data ?? null;
  }

  return { vendor, stall: activeStall };
}
