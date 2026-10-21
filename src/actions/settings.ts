"use server";

import { revalidatePath } from "next/cache";
import { requireVendor } from "@/lib/auth";
import type { ProfileInput, SimpleResult, StallInput } from "@/lib/action-types";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const cleanHandle = (value: string) => value.replace(/^@/, "").trim();

export async function updateStallAction(input: StallInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();
  const name = input.name.trim() || vendor.business_name;
  const tagline = input.tagline.trim();
  const accent = HEX.test(input.accent_color) ? input.accent_color : "#0F8A4D";

  const [stallResult, vendorResult] = await Promise.all([
    supabase
      .from("stalls")
      .update({ name, tagline, accent_color: accent })
      .eq("vendor_id", vendor.id),
    supabase
      .from("vendors")
      .update({ business_name: name, motto: tagline })
      .eq("id", vendor.id),
  ]);

  if (stallResult.error) return { ok: false, error: stallResult.error.message };
  if (vendorResult.error) return { ok: false, error: vendorResult.error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProfileAction(input: ProfileInput): Promise<SimpleResult> {
  const { supabase, vendor } = await requireVendor();

  if (!input.owner_name.trim() || !input.business_name.trim()) {
    return { ok: false, error: "Vendor and business name are needed" };
  }
  if (input.phone.replace(/\D/g, "").length < 9) {
    return { ok: false, error: "Enter a valid phone number" };
  }
  if (!/^\S+@\S+\.\S+$/.test(input.email)) {
    return { ok: false, error: "Enter a valid email" };
  }

  const { error } = await supabase
    .from("vendors")
    .update({
      owner_name: input.owner_name.trim(),
      business_name: input.business_name.trim(),
      phone: input.phone.trim(),
      phone2: input.phone2.trim() || null,
      email: input.email.trim(),
      category: input.category,
      region: input.location.trim(),
      motto: input.motto.trim(),
      instagram: cleanHandle(input.instagram) || null,
      facebook: cleanHandle(input.facebook) || null,
      tiktok: cleanHandle(input.tiktok) || null,
      whatsapp: input.whatsapp.trim() || null,
      logo_url: input.logo_url,
    })
    .eq("id", vendor.id);

  if (error) return { ok: false, error: error.message };

  await supabase
    .from("stalls")
    .update({
      name: input.business_name.trim(),
      tagline: input.motto.trim(),
    })
    .eq("vendor_id", vendor.id);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<SimpleResult> {
  if (newPassword.length < 6) {
    return { ok: false, error: "New password needs at least 6 characters" };
  }
  const { supabase, user } = await requireVendor();
  if (!user.email) return { ok: false, error: "Your account has no email address" };

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) return { ok: false, error: "Current password is wrong" };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
