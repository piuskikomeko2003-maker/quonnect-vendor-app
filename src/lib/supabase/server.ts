import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { AppDatabase } from "@/types/app-db";
import { authCookieOptions } from "@/lib/supabase/auth-cookie-options";

async function isHttpsRequest(): Promise<boolean> {
  try {
    const requestHeaders = await headers();
    const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (forwardedProto) return forwardedProto === "https";
    const origin = requestHeaders.get("origin");
    if (origin) return origin.startsWith("https://");
  } catch {
    // Outside a request scope (e.g. build-time rendering); assume plain HTTP.
  }
  return false;
}

export async function createClient() {
  const cookieStore = await cookies();
  const https = await isHttpsRequest();

  return createServerClient<AppDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(https),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component; proxy refreshes the session instead.
          }
        },
      },
    },
  );
}
