import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-only — never import this from a Client Component
 * or expose SUPABASE_SERVICE_ROLE_KEY via NEXT_PUBLIC_*. Used for platform-admin
 * actions that bypass RLS (e.g. inviting a restaurant owner by email).
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
