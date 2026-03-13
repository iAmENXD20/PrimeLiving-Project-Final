import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// Admin client -- uses service_role key, bypasses RLS
// Use this for admin operations (creating users, managing all data)
export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Create a per-request Supabase client using the user's JWT
// This respects RLS policies based on the authenticated user
export function createSupabaseClient(accessToken: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
