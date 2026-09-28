import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

const envConfig = dotenv.parse(readFileSync('.env.local'));
const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const tablesInDeleteOrder = [
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

async function emptyDatabase() {
  console.log('Emptying database tables...');
  for (const table of tablesInDeleteOrder) {
    try {
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        console.log(`Table ${table} delete result:`, error.message);
      } else {
        console.log(`Table ${table} cleared successfully.`);
      }
    } catch (err) {
      console.log(`Exception on table ${table}:`, err.message);
    }
  }
  console.log('Database empty process completed.');
}

emptyDatabase();
