import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

// Load .env.local
const envConfig = dotenv.parse(readFileSync('.env.local'));
const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing connection to Supabase...');
console.log('URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // Attempt to query any public endpoint or auth health check
    const { data, error } = await supabase.from('vendors').select('*').limit(1);
    
    // Note: 'vendors' table might not exist yet (code 42P01 in postgres or PGRST204 / 404 from PostgREST)
    // But if we get a response from PostgREST (even table not found), network connection and API key are verified!
    if (error) {
      console.log('PostgREST Response Code:', error.code, 'Message:', error.message);
      if (error.code === 'PGRST205' || error.code === '42P01' || error.message.includes('not found') || error.message.includes('relation') || error.code === 'PGRST116') {
        console.log('✅ Supabase connected successfully! (Table does not exist yet as expected)');
        process.exit(0);
      } else {
        console.error('❌ Supabase error:', error);
        process.exit(1);
      }
    } else {
      console.log('✅ Supabase connected successfully! Data received:', data);
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Network or unexpected error:', err);
    process.exit(1);
  }
}

testConnection();
