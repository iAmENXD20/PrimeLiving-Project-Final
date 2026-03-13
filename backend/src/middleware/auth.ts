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
  const metadataRole =
    normalizeRole(user?.user_metadata?.role) ||
    normalizeRole(user?.app_metadata?.role) ||
    normalizeRole(user?.app_metadata?.user_role);

  if (metadataRole) return metadataRole;

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

  return "tenant";
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
