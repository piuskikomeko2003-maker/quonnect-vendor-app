import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/browser";
import { clearSessionCache } from "@/lib/auth-session";
import { markSignedIn, markSignedOut } from "@/lib/auth-marker";
import { ensureVendorProfile } from "@/lib/vendor";
import { NEW_VENDOR_FEATURES } from "@/lib/features";
import type { ActionResult, SignupInput } from "@/lib/auth-types";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
const NATIVE_SCHEME = "com.quonnect.vendor";
const cleanHandle = (value: string) => value.replace(/^@/, "").trim();

/**
 * Where Supabase should send the user after an email link.
 * Web uses the current origin; the bundled app uses its custom scheme, which
 * the NativeBridge component routes back into /auth/confirm.
 */
function authRedirectUrl(path: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  if (Capacitor.isNativePlatform()) return `${NATIVE_SCHEME}:///${path}`;
  return `${window.location.origin}/${path.replace(/^\/+/, "")}`;
}

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/fetch failed|failed to fetch|ENOTFOUND|network|ECONNREFUSED|timeout/i.test(message)) {
    let host = "the configured Supabase project";
    try {
      host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host || host;
    } catch {
      // Keep the generic message.
    }
    return `Cannot reach Supabase at ${host}. The project may be paused, deleted, or .env.local is pointing at the wrong URL. Restore the project or update the URL and anon key, then restart the app.`;
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

/** Turn a base64 data URL into bytes without Node's Buffer. */
function dataUrlBytes(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return null;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return {
    bytes,
    contentType: match[1],
    extension: match[1].split("/")[1]?.replace("jpeg", "jpg") ?? "jpg",
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

  const supabase = createClient();
  let signUpResult: Awaited<ReturnType<typeof supabase.auth.signUp>>;
  try {
    signUpResult = await supabase.auth.signUp({
      email: fields.email,
      password: fields.password,
      options: {
        emailRedirectTo: authRedirectUrl("auth/confirm"),
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
    console.error("[auth] signUp threw:", error);
    return { ok: false, error: friendlyAuthError(error) };
  }

  const { data, error } = signUpResult;
  if (error) {
    console.error("[auth] signUp failed:", error);
    return { ok: false, error: friendlyAuthError(error) };
  }
  if (!data.user) return { ok: false, error: "Could not create your account" };

  if (!data.session) {
    // Supabase returns no session when "Confirm email" is enabled, but some
    // projects create the user already-confirmed and expect an immediate
    // sign-in. Try it so the vendor never has to retype their password.
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: fields.email,
        password: fields.password,
      });
      if (signInError || !signInData.session) {
        return { ok: true, needsConfirmation: true };
      }
    } catch {
      return { ok: true, needsConfirmation: true };
    }
  }

  // A real session exists from here on.
  clearSessionCache();
  markSignedIn();

  let logoUrl: string | null = null;
  if (input.logoDataUrl) {
    const decoded = dataUrlBytes(input.logoDataUrl);
    if (decoded) {
      try {
        const path = `${data.user.id}/logo.${decoded.extension}`;
        const { error: uploadError } = await supabase.storage
          .from("vendor-assets")
          .upload(path, decoded.bytes, { contentType: decoded.contentType, upsert: true });
        if (!uploadError) {
          logoUrl = supabase.storage.from("vendor-assets").getPublicUrl(path).data.publicUrl;
        }
      } catch {
        // A missing logo should not block account creation.
      }
    }
  }

  if (logoUrl) {
    await supabase.auth.updateUser({ data: { logo_url: logoUrl } });
  }

  const { vendor } = await ensureVendorProfile(supabase, data.user);
  if (vendor) {
    // New signups start with the four core screens; optional features stay off
    // until the vendor turns them on or first needs them.
    const flags = (vendor.features_enabled ?? {}) as Record<string, unknown>;
    if (Object.keys(flags).length === 0) {
      await supabase
        .from("vendors")
        .update({ features_enabled: NEW_VENDOR_FEATURES })
        .eq("id", vendor.id);
    }
  }
  if (vendor && logoUrl) {
    await supabase.from("vendors").update({ logo_url: logoUrl }).eq("id", vendor.id);
  }

  return { ok: true };
}

export async function signInAction(email: string, password: string): Promise<ActionResult> {
  const supabase = createClient();
  let signInResult: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
  try {
    signInResult = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
  } catch (error) {
    console.error("[auth] signIn threw:", error);
    return { ok: false, error: friendlyAuthError(error) };
  }

  const { data, error } = signInResult;
  if (error) {
    console.error("[auth] signIn failed:", error);
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { ok: false, error: "Confirm your email first, then log in" };
    }
    return { ok: false, error: friendlyAuthError(error) };
  }
  if (data.user) await ensureVendorProfile(supabase, data.user);
  // Record the session hint and drop any cached anonymous lookup so the app
  // shell opens without another auth round trip.
  clearSessionCache();
  markSignedIn();
  return { ok: true };
}

export async function signOutAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  clearSessionCache();
  markSignedOut();
  if (typeof window !== "undefined") window.location.assign("/login");
}

export async function requestPasswordReset(email: string): Promise<ActionResult> {
  if (!EMAIL_RE.test(email.trim())) {
    return { ok: false, error: "Enter your email first, then tap Forgot password" };
  }
  const supabase = createClient();
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: authRedirectUrl("auth/confirm?next=/settings"),
    });
    if (error) {
      console.error("[auth] resetPasswordForEmail failed:", error);
      return { ok: false, error: friendlyAuthError(error) };
    }
    return { ok: true };
  } catch (error) {
    console.error("[auth] resetPasswordForEmail threw:", error);
    return { ok: false, error: friendlyAuthError(error) };
  }
}
