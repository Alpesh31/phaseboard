import { createClient } from '@supabase/supabase-js';

/** Browser client: uses only public/anon credentials. Never put a service-role key here. */
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase is not configured. See SETUP-V8.md');
  return createClient(url, key);
}
