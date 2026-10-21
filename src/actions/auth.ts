"use server";

import { Buffer } from "node:buffer";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureVendorProfile } from "@/lib/vendor";
import type { ActionResult, SignupInput } from "@/lib/auth-types";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const cleanHandle = (value: string) => value.replace(/^@/, "").trim();

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/fetch failed|failed to fetch|ENOTFOUND|network|ECONNREFUSED|timeout/i.test(message)) {
    let host = "the configured Supabase project";
    try {
      host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host || host;
    } catch {
      // Keep the generic message.
    }
    return `Cannot reach Supabase at ${host}. The project may be paused, deleted, or .env.local is pointing at the wrong URL. Restore the project or update the URL and anon key, then restart the dev server.`;
  }
  return message || "Could not reach Supabase";
}

function normalise(input: SignupInput) {
  return {
    ownerName: input.ownerName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    password: input.password,
    businessName: input.businessName.trim(),
    category: input.category.trim(),
    location: input.location.trim(),
    motto: input.motto.trim(),
    instagram: cleanHandle(input.instagram),
    facebook: cleanHandle(input.facebook),
    tiktok: cleanHandle(input.tiktok),
    whatsapp: input.whatsapp.trim(),
  };
}

export async function signUpAction(input: SignupInput): Promise<ActionResult> {
  const fields = normalise(input);

  if (fields.ownerName.length < 2) return { ok: false, error: "Enter your name" };
  if (fields.phone.replace(/\D/g, "").length < 9) {
    return { ok: false, error: "Enter a valid phone number" };
  }
  if (!EMAIL_RE.test(fields.email)) return { ok: false, error: "Enter a valid email" };
  if (fields.password.length < 6) {
    return { ok: false, error: "Password needs at least 6 characters" };
  }
  if (!fields.businessName) return { ok: false, error: "Enter your business name" };
  if (!fields.category) return { ok: false, error: "Choose a business category" };
  if (!fields.location) return { ok: false, error: "Enter your location" };

  const supabase = await createClient();
  let signUpResult: Awaited<ReturnType<typeof supabase.auth.signUp>>;
  try {
    signUpResult = await supabase.auth.signUp({
      email: fields.email,
      password: fields.password,
      options: {
        data: {
          owner_name: fields.ownerName,
          business_name: fields.businessName,
          category: fields.category,
          region: fields.location,
          phone: fields.phone,
          motto: fields.motto,
          instagram: fields.instagram,
          facebook: fields.facebook,
          tiktok: fields.tiktok,
          whatsapp: fields.whatsapp,
        },
      },
    });
  } catch (error) {
    return { ok: false, error: friendlyAuthError(error) };
  }

  const { data, error } = signUpResult;
  if (error) return { ok: false, error: friendlyAuthError(error) };
  if (!data.user) return { ok: false, error: "Could not create your account" };

  if (!data.session) {
    return { ok: true, needsConfirmation: true };
  }

  let logoUrl: string | null = null;
  if (input.logoDataUrl?.startsWith("data:image/")) {
    try {
      const match = input.logoDataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
      if (match) {
        const bytes = Buffer.from(match[2], "base64");
        const extension = match[1].split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const path = `${data.user.id}/logo.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-assets")
          .upload(path, bytes, { contentType: match[1], upsert: true });
        if (!uploadError) {
          logoUrl = supabase.storage.from("vendor-assets").getPublicUrl(path).data.publicUrl;
        }
      }
    } catch {
      // A missing logo should not block account creation.
    }
  }

  if (logoUrl) {
    await supabase.auth.updateUser({ data: { logo_url: logoUrl } });
  }

  const { vendor } = await ensureVendorProfile(supabase, data.user);
  if (vendor && logoUrl) {
    await supabase.from("vendors").update({ logo_url: logoUrl }).eq("id", vendor.id);
  }

  return { ok: true };
}

export async function signInAction(email: string, password: string): Promise<ActionResult> {
  const supabase = await createClient();
  let signInResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
  try {
    signInResult = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
  } catch (error) {
    return { ok: false, error: friendlyAuthError(error) };
  }

  const { data, error } = signInResult;
  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { ok: false, error: "Confirm your email first, then log in" };
    }
    return { ok: false, error: friendlyAuthError(error) };
  }
  if (data.user) await ensureVendorProfile(supabase, data.user);
  return { ok: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  if (!EMAIL_RE.test(email.trim())) {
    return { ok: false, error: "Enter your email first, then tap Forgot password" };
  }
  const supabase = await createClient();
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) return { ok: false, error: friendlyAuthError(error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: friendlyAuthError(error) };
  }
}
