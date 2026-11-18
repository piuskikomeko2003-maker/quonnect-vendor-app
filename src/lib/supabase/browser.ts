import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { AppDatabase } from "@/types/app-db";

let client: ReturnType<typeof createSupabaseClient<AppDatabase>> | undefined;

/**
 * Browser/mobile Supabase client.
 *
 * Sessions live in localStorage (not cookies) so the same code works in the
 * web app and inside the Capacitor WebView. `flowType: "pkce"` keeps the code
 * verifier on the device, which the /auth/confirm page needs after an email
 * link or deep link returns to the app.
 */
export function createClient() {
  if (!client) {
    client = createSupabaseClient<AppDatabase>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
          storageKey: "quonnect-vendor-auth",
        },
      },
    );
  }
  return client;
}
