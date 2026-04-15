import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { isValidEmailFormat } from "../utils/emailValidation";

function toInviteConfirmUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "") + "/invite/confirm";
}

/**
 * GET /api/owners
 * Get all owners
 */
export async function getOwners(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("apartment_owners")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/owners/:id
 * Get a single owner by ID
 */
export async function getOwnerById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("apartment_owners")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      sendError(res, error.message, 404);
      return;
    }

    sendSuccess(res, data);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/owners/:id/location
 * Get owner apartment location for authorized users tied to the same owner.
 */
export async function getOwnerLocation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const user = req.user;

    if (!user) {
      sendError(res, "Authentication required", 401);
      return;
    }

    let allowed = false;

    if (user.role === "owner") {
      const { data: owner } = await supabaseAdmin
        .from("apartment_owners")
        .select("id")
        .eq("id", id)
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (owner) allowed = true;
      allowed = Boolean(owner);
    } else if (user.role === "manager") {
      const { data: manager } = await supabaseAdmin
        .from("apartment_managers")
        .select("apartmentowner_id")
        .eq("auth_user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      allowed = manager?.apartmentowner_id === id;
    } else if (user.role === "tenant") {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("apartmentowner_id")
        .eq("auth_user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      allowed = tenant?.apartmentowner_id === id;
    }

    if (!allowed) {
      sendError(res, "Access denied", 403);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("apartment_owners")
      .select("id, first_name, last_name")
      .eq("id", id)
      .single();

    if (error) {
      sendError(res, error.message, 404);
      return;
    }

    sendSuccess(res, data);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/owners/by-auth/:authUserId
 * Get an owner by their auth_user_id
 */
export async function getOwnerByAuthId(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { authUserId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("apartment_owners")
      .select("*")
      .eq("auth_user_id", authUserId)
      .single();

    if (error) {
      sendError(res, error.message, 404);
      return;
    }

    sendSuccess(res, data);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/owners
 * Create a new owner (also creates a Supabase Auth account)
 */
export async function createOwner(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const {
      first_name, last_name, email, phone,
    } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      sendError(res, "Email is required", 400);
      return;
    }

    if (!isValidEmailFormat(normalizedEmail)) {
      sendError(res, "Please enter a valid email address", 400);
      return;
    }

    const [existingOwnerLookup, existingManagerLookup, existingTenantLookup] = await Promise.all([
      supabaseAdmin.from("apartment_owners").select("id").eq("email", normalizedEmail).maybeSingle(),
      supabaseAdmin.from("apartment_managers").select("id").eq("email", normalizedEmail).maybeSingle(),
      supabaseAdmin.from("tenants").select("id").eq("email", normalizedEmail).maybeSingle(),
    ]);

    if (existingOwnerLookup.error || existingManagerLookup.error || existingTenantLookup.error) {
      sendError(
        res,
        existingOwnerLookup.error?.message ||
          existingManagerLookup.error?.message ||
          existingTenantLookup.error?.message ||
          "Failed to validate email",
        500
      );
      return;
    }

    if (existingOwnerLookup.data || existingManagerLookup.data || existingTenantLookup.data) {
      sendError(res, "Email is already used by another account", 409);
      return;
    }

    const requestOrigin = req.headers.origin;
    const baseRedirectUrl =
      requestOrigin && /^https?:\/\//i.test(requestOrigin)
        ? requestOrigin
        : env.FRONTEND_URL;
    const redirectTo = toInviteConfirmUrl(baseRedirectUrl);

    // Invite owner via email verification flow
    const { data: inviteData, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo,
        data: {
          role: "owner",
          name: `${first_name} ${last_name}`.trim(),
          login_email: normalizedEmail,
          app_name: "E-AMS",
        },
      });

    if (authError) {
      sendError(res, authError.message);
      return;
    }

    if (!inviteData.user?.id) {
      sendError(res, "Failed to create owner auth account", 500);
      return;
    }

    // Create owner record linked to auth user
    const { data, error } = await supabaseAdmin
      .from("apartment_owners")
      .insert({
        auth_user_id: inviteData.user.id,
        first_name,
        last_name: last_name || '',
        email: normalizedEmail,
        phone,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      // Cleanup: delete the auth user if owner record fails
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(
      res,
      { ...data, requiresEmailVerification: true },
      "Owner created successfully. Verification email sent.",
      201
    );
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/owners/:id
 * Update an owner
 */
export async function updateOwner(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    // Whitelist allowed fields to prevent overwriting auth_user_id, id, etc.
    const allowedFields = ["first_name", "last_name", "email", "phone", "status", "updated_at", "payment_info"];
    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      sendError(res, "No valid fields to update", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("apartment_owners")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Owner updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/owners/:id
 * Delete an owner
 */
export async function deleteOwner(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    // Fetch owner to get auth_user_id before deleting
    const { data: owner, error: fetchError } = await supabaseAdmin
      .from("apartment_owners")
      .select("auth_user_id")
      .eq("id", id)
      .single();

    if (fetchError) {
      sendError(res, fetchError.message, 404);
      return;
    }

    const { error } = await supabaseAdmin
      .from("apartment_owners")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    // Cleanup: delete the Supabase Auth user
    if (owner?.auth_user_id) {
      await supabaseAdmin.auth.admin.deleteUser(owner.auth_user_id);
    }

    sendSuccess(res, null, "Owner deleted successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/owners/count
 * Get total owner count
 */
export async function getOwnerCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { count, error } = await supabaseAdmin
      .from("apartment_owners")
      .select("*", { count: "exact", head: true });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, { count });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
