import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// --- Admin client with auto-reconnect health check ---

function createAdminClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

let _adminClient: SupabaseClient = createAdminClient();

// Proxy ensures all importers always use the current (possibly recreated) client
// without needing to change any import statements across the codebase
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const value = (_adminClient as any)[prop];
    if (typeof value === "function") {
      return value.bind(_adminClient);
    }
    return value;
  },
});

// --- Connection health check ---

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

async function checkConnection(): Promise<boolean> {
  try {
    const { error } = await _adminClient
      .from("apartment_owners")
      .select("id", { count: "exact", head: true });
    return !error;
  } catch {
    return false;
  }
}

export function startHealthCheck(intervalMs = 30_000): void {
  if (healthCheckInterval) return;
  console.log(
    `[Health] Connection health check started (every ${intervalMs / 1000}s)`
  );
  healthCheckInterval = setInterval(async () => {
    const healthy = await checkConnection();
    if (!healthy) {
      console.warn(
        "[Health] Stale Supabase connection detected — recreating client..."
      );
      _adminClient = createAdminClient();
      const retry = await checkConnection();
      if (retry) {
        console.log("[Health] Connection restored successfully.");
      } else {
        console.error("[Health] Connection still failing after recreation.");
      }
    }
  }, intervalMs);
}

export function stopHealthCheck(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

// --- Per-request client (unchanged) ---

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
