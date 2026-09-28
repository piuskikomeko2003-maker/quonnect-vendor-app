import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

const envConfig = dotenv.parse(readFileSync('.env.local'));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const tables = [
  'sale_items',
  'sales',
  'payments',
  'bookings',
  'damaged_items',
  'purchases',
  'quotations',
  'activity_log',
  'shop_suggestions',
  'finance_entries',
  'products',
  'customers',
  'suppliers',
  'stores',
  'shop_members',
  'vendors',
];

async function checkCounts() {
  console.log('--- Checking database table counts ---');
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`Table "${table}": error ->`, error.message);
      } else {
        console.log(`Table "${table}": ${count} rows`);
      }
    } catch (e) {
      console.log(`Table "${table}": exception ->`, e.message);
    }
  }
}

checkCounts();
