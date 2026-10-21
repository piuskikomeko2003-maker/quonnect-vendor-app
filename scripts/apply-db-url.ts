/**
 * Applies the validated schema bundle using a direct Postgres connection.
 * Requires SUPABASE_DB_URL in .env.local (Session pooler connection string).
 * Never prints or commits the connection string.
 *
 *   npm run db:apply
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Add SUPABASE_DB_URL to .env.local (Supabase Dashboard -> Connect -> Session pooler).");
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to Postgres.");

  const sql = readFileSync("supabase/APPLY_ON_DASHBOARD.sql", "utf8");
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Schema applied successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed. Nothing was committed.");
    console.error(error);
    process.exitCode = 1;
    return;
  } finally {
    await client.end();
  }

  const verify = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await verify.connect();
  const checks = await verify.query(`
    SELECT
      (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='vendors' AND column_name='owner_name') AS vendor_owner,
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='sales') AS sales,
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='stalls') AS stalls,
      (SELECT count(*) FROM information_schema.routines WHERE routine_schema='public' AND routine_name='create_sale') AS create_sale,
      (SELECT count(*) FROM information_schema.routines WHERE routine_schema='public' AND routine_name='vendor_home_overview') AS home_rpc
  `);
  console.log("Verification:", checks.rows[0]);
  await verify.end();
}

void main();
