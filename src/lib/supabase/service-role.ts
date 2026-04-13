import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin client for server-only Storage (and other admin) calls.
 * Never import this from Client Components — `SUPABASE_SERVICE_ROLE_KEY` is server-only.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
