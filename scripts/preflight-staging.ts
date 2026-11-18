/**
 * Read-only preflight for a staging/branch database.
 *
 *   npm run preflight:staging
 *
 * Refuses to run against the production project. Prints the row counts the
 * Milestone B plan needs, especially public.payments. No writes.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRODUCTION_PROJECT_REF = "akfktjvckvlfclkwjppn";

function projectRef(value: string): string | null {
  const match = value.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (projectRef(url) === PRODUCTION_PROJECT_REF) {
  console.error(
    "Refusing to run the staging preflight against production (akfktjvckvlfclkwjppn).",
  );
  process.exit(2);
}

const resolvedUrl = url;
const admin = createClient(resolvedUrl, serviceKey, { auth: { persistSession: false } });

const tables = [
  "vendors",
  "products",
  "sales",
  "sale_items",
  "payments",
  "finance_entries",
  "customers",
  "stock_movements",
  "budgets",
] as const;

async function main() {
  console.log(`Staging project: ${projectRef(resolvedUrl) ?? "unknown"}`);
  const counts: Record<string, number | string> = {};

  for (const table of tables) {
    const { count, error } = await admin
      .from(table)
      .select("*", { count: "exact", head: true });
    counts[table] = error ? `ERROR: ${error.message}` : count ?? 0;
  }

  console.log(JSON.stringify(counts, null, 2));

  if (typeof counts.payments === "number" && counts.payments > 0) {
    console.error(
      "\nSTOP: public.payments is not empty. Do not alter it until the rows are inspected and the plan is revised.",
    );
    process.exit(3);
  }

  console.log("\npublic.payments is empty. Milestone B preflight can proceed.");
}

main().catch((error) => {
  console.error("Preflight failed:", error);
  process.exit(1);
});
