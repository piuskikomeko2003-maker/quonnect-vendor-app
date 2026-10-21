import { createBrowserClient } from "@supabase/ssr";
import type { AppDatabase } from "@/types/app-db";

let client: ReturnType<typeof createBrowserClient<AppDatabase>> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<AppDatabase>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return client;
}
