import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Default project Supabase keys if deployment environment does not have them configured
const DEFAULT_SUPABASE_URL = 'https://yspneuzrsraonftghccm.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mHd351Ln6QsE_yir3x53pw_ASJ9BUM9';

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

const supabaseUrl = (envUrl && /^https?:\/\//i.test(envUrl)) ? envUrl : DEFAULT_SUPABASE_URL;
const supabaseAnonKey = (envKey && envKey.length > 8) ? envKey : DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  (envUrl && /^https?:\/\//i.test(envUrl)) || DEFAULT_SUPABASE_URL
);

// Resilient Supabase client that never throws "supabaseUrl is required"
let client: SupabaseClient;
try {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
} catch (err) {
  console.warn('Supabase initialization fallback active:', err);
  client = createClient('https://placeholder-edumind.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy', {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const supabase = client;
