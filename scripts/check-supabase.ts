import { lookup } from "node:dns/promises";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

async function main() {
  const host = new URL(url!).host;
  console.log(`Project: ${url}`);

  try {
    const addresses = await lookup(host, { all: true });
    console.log(`DNS: ${addresses.map((entry) => entry.address).join(", ")}`);
  } catch (error) {
    console.error(`DNS: FAILED (${error instanceof Error ? error.message : error})`);
    console.error("\nThe hostname does not resolve. The Supabase project is deleted, paused without a DNS record,");
    console.error("or the URL is wrong. Restore/create the project in the Supabase dashboard, update .env.local");
    console.error("with the project URL and anon key, then restart `npm run dev`.");
    process.exitCode = 1;
    return;
  }

  for (const path of ["/auth/v1/health", "/rest/v1/"]) {
    try {
      const response = await fetch(`${url}${path}`, {
        headers: { apikey: key!, Authorization: `Bearer ${key!}` },
        signal: AbortSignal.timeout(10_000),
      });
      console.log(`${path}: HTTP ${response.status}`);
    } catch (error) {
      console.error(`${path}: FAILED (${error instanceof Error ? error.message : error})`);
      process.exitCode = 1;
    }
  }
}

void main();
