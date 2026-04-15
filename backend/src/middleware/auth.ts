import { Response, NextFunction } from "express";
import { supabaseAdmin, createSupabaseClient } from "../config/supabase";
import { AuthenticatedRequest, UserRole } from "../types";

function normalizeRole(rawRole: unknown): UserRole | null {
  if (typeof rawRole !== "string") return null;

  const normalized = rawRole.toLowerCase().trim();
  if (normalized === "client" || normalized === "admin") return "owner";
  if (
    normalized === "owner" ||
    normalized === "manager" ||
    normalized === "tenant"
  ) {
    return normalized;
  }

  return null;
}

async function resolveUserRoleAndStatus(userId: string, user: any): Promise<{ role: UserRole; active: boolean; status?: string }> {
  const [ownerRes, managerRes, tenantRes] = await Promise.all([
    supabaseAdmin
      .from("apartment_owners")
      .select("id,status")
      .eq("auth_user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("apartment_managers")
      .select("id,status")
      .eq("auth_user_id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("tenants")
      .select("id,status")
      .eq("auth_user_id", userId)
      .maybeSingle(),
  ]);

  if (ownerRes.data) {
    const s = ownerRes.data.status || "active";
    return { role: "owner", active: s === "active", status: s };
  }
  if (managerRes.data) {
    const s = managerRes.data.status || "active";
    return { role: "manager", active: s === "active", status: s };
  }
  if (tenantRes.data) {
    const s = tenantRes.data.status || "active";
    return { role: "tenant", active: s === "active", status: s };
  }

  // Fallback to metadata role — no row found, so treat as active
  // (the user has a valid JWT but no profile row yet)
  const metadataRole =
    normalizeRole(user?.user_metadata?.role) ||
    normalizeRole(user?.app_metadata?.role) ||
    normalizeRole(user?.app_metadata?.user_role);

  return { role: metadataRole || "tenant", active: true, status: "active" };
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

    // Resolve role and check active status in a single query set
    const { role, active: isActive, status: roleStatus } = await resolveUserRoleAndStatus(user.id, user);

    // Allow pending users through for activation endpoints
    const isActivationPath = req.path === "/confirm-activation";

    if (!isActive && !isActivationPath) {
      let msg = "Account is not active yet";
      if (roleStatus === "pending_verification") {
        const approver = role === "tenant" ? "apartment manager" : "apartment owner";
        msg = `Your account is currently under review. Please wait for your ${approver} to approve your account before you can log in.`;
      } else if (roleStatus === "pending") {
        msg = "Please complete your account setup by accepting the invitation sent to your email.";
      }
      res.status(403).json({
        success: false,
        error: msg,
        status: roleStatus,
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
