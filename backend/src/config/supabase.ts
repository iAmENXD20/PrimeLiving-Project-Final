import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

// --- Admin client with periodic rotation to prevent stale state ---

function createAdminClient(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

let _adminClient: SupabaseClient = createAdminClient();
let _adminCreatedAt: number = Date.now();

// Rotate the admin client every 60 seconds to prevent stale connections
const ADMIN_CLIENT_MAX_AGE_MS = 60_000;

function getAdminClient(): SupabaseClient {
  if (Date.now() - _adminCreatedAt > ADMIN_CLIENT_MAX_AGE_MS) {
    _adminClient = createAdminClient();
    _adminCreatedAt = Date.now();
  }
  return _adminClient;
}

/**
 * Force-refresh the admin client. Call this when you detect an
 * "impossible" error (e.g. RLS violation with service_role).
 */
export function refreshAdminClient(): void {
  console.warn("[Supabase] Force-refreshing admin client");
  _adminClient = createAdminClient();
  _adminCreatedAt = Date.now();
}

// Proxy ensures all importers always use the current (possibly recreated) client
// without needing to change any import statements across the codebase
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getAdminClient();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

// --- Connection health check ---

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

async function checkConnection(): Promise<boolean> {
  try {
    const client = getAdminClient();
    const { error } = await client
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
      refreshAdminClient();
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
