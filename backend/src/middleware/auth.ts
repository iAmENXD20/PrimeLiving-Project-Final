import { Response, NextFunction } from "express";
import { supabaseAdmin, createSupabaseClient } from "../config/supabase";
import { AuthenticatedRequest, UserRole } from "../types";

function normalizeRole(rawRole: unknown): UserRole | null {
  if (typeof rawRole !== "string") return null;

  const normalized = rawRole.toLowerCase().trim();
  if (normalized === "client") return "owner";
  if (
    normalized === "admin" ||
    normalized === "owner" ||
    normalized === "manager" ||
    normalized === "tenant"
  ) {
    return normalized;
  }

  return null;
}

async function resolveUserRole(userId: string, user: any): Promise<UserRole> {
  const [ownerRes, managerRes, tenantRes] = await Promise.all([
    supabaseAdmin
      .from("clients")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("managers")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle(),
  ]);

  if (ownerRes.data) return "owner";
  if (managerRes.data) return "manager";
  if (tenantRes.data) return "tenant";

  const metadataRole =
    normalizeRole(user?.user_metadata?.role) ||
    normalizeRole(user?.app_metadata?.role) ||
    normalizeRole(user?.app_metadata?.user_role);

  if (metadataRole === "admin") return "admin";

  return "tenant";
}

async function ensureRoleIsActive(role: UserRole, userId: string): Promise<boolean> {
  if (role === "admin") {
    return true;
  }

  if (role === "owner") {
    const { data } = await supabaseAdmin
      .from("clients")
      .select("id,status")
      .eq("auth_user_id", userId)
      .maybeSingle();

    return Boolean(data && (data.status || "active") === "active");
  }

  if (role === "manager") {
    const { data } = await supabaseAdmin
      .from("managers")
      .select("id,status")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (!data) {
      return false;
    }

    if (data.status === "pending") {
      await supabaseAdmin
        .from("managers")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", data.id);
      return true;
    }

    return (data.status || "active") === "active";
  }

  const { data } = await supabaseAdmin
    .from("tenants")
    .select("id,status")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (!data) {
    return false;
  }

  if (data.status === "pending") {
    await supabaseAdmin
      .from("tenants")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", data.id);
    return true;
  }

  return (data.status || "active") === "active";
}

/**
 * Authentication middleware
 * Verifies the JWT from the Authorization header using Supabase,
 * attaches user info and a per-request Supabase client to the request.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: "Missing or invalid authorization header",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    // Verify the JWT using Supabase admin client
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
      return;
    }

    // Extract role from metadata and fallback to profile table linkage
    const role = await resolveUserRole(user.id, user);

    const isActive = await ensureRoleIsActive(role, user.id);
    if (!isActive) {
      res.status(403).json({
        success: false,
        error: "Account is not active yet",
      });
      return;
    }

    // Attach user info to the request
    req.user = {
      id: user.id,
      email: user.email || "",
      role,
    };

    // Attach the token for downstream use
    req.token = token;

    // Create a per-request Supabase client with the user's JWT
    req.supabase = createSupabaseClient(token);

    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: "Authentication failed",
    });
  }
}
