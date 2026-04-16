import { supabaseAdmin, refreshAdminClient } from "../config/supabase";
import { PostgrestSingleResponse, PostgrestResponse } from "@supabase/supabase-js";

/**
 * Execute a Supabase admin query with automatic retry on stale-client errors.
 * Catches RLS violations and connection errors that shouldn't happen with
 * service_role, force-refreshes the admin client, and retries once.
 */
export async function withAdminRetry<T>(
  queryFn: (client: typeof supabaseAdmin) => PromiseLike<PostgrestSingleResponse<T> | PostgrestResponse<T>>,
): Promise<PostgrestSingleResponse<T> | PostgrestResponse<T>> {
  const result = await queryFn(supabaseAdmin);

  if (result.error && isStaleClientError(result.error.message)) {
    console.warn("[withAdminRetry] Detected stale client error — refreshing and retrying:", result.error.message);
    refreshAdminClient();
    return queryFn(supabaseAdmin);
  }

  return result;
}

function isStaleClientError(message: string): boolean {
  return (
    message.includes("row-level security") ||
    message.includes("JWT expired") ||
    message.includes("PGRST") ||
    message.includes("connection") ||
    message.includes("fetch failed")
  );
}
