import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null | undefined;

/**
 * Read-only Supabase client for the browser, using the publishable (anon) key.
 * Row Level Security limits it to SELECT and the public RPCs. Returns null when the
 * env vars are missing so callers can fall back to static data.
 * Never use the service role key here; that lives in src/lib/supabase/admin.ts (server only).
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  browserClient =
    url && key
      ? createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        })
      : null;
  return browserClient;
}
