import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { isValidEmailFormat } from "../utils/emailValidation";

function toInviteConfirmUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return normalizedBase.endsWith("/invite/confirm")
    ? normalizedBase
    : `${normalizedBase}/invite/confirm`;
}

/**
 * GET /api/clients
 * Get all clients
 */
export async function getClients(
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
 * GET /api/clients/:id
 * Get a single client by ID
 */
export async function getClientById(
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
 * GET /api/clients/:id/location
 * Get client apartment location for authorized users tied to the same client.
 */
export async function getClientLocation(
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

    if (user.role === "admin") {
      allowed = true;
    } else if (user.role === "owner") {
      const { data: owner } = await supabaseAdmin
        .from("apartment_owners")
        .select("id")
        .eq("id", id)
        .eq("auth_user_id", user.id)
        .maybeSingle();
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
      .select("id, apartment_address, name")
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
 * GET /api/clients/by-auth/:authUserId
 * Get a client by their auth_user_id
 */
export async function getClientByAuthId(
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
 * POST /api/clients
 * Create a new client (also creates a Supabase Auth account)
 */
export async function createClient(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const {
      name, email, phone, apartment_address,
      sex, age, apartment_classification,
      street_building, barangay, province, city_municipality,
      number_of_units, number_of_floors, number_of_rooms, other_property_details,
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

    const [existingClientLookup, existingManagerLookup, existingTenantLookup] = await Promise.all([
      supabaseAdmin.from("apartment_owners").select("id").eq("email", normalizedEmail).maybeSingle(),
      supabaseAdmin.from("apartment_managers").select("id").eq("email", normalizedEmail).maybeSingle(),
      supabaseAdmin.from("tenants").select("id").eq("email", normalizedEmail).maybeSingle(),
    ]);

    if (existingClientLookup.error || existingManagerLookup.error || existingTenantLookup.error) {
      sendError(
        res,
        existingClientLookup.error?.message ||
          existingManagerLookup.error?.message ||
          existingTenantLookup.error?.message ||
          "Failed to validate email",
        500
      );
      return;
    }

    if (existingClientLookup.data || existingManagerLookup.data || existingTenantLookup.data) {
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
          name,
          login_email: normalizedEmail,
          app_name: "PrimeLiving",
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

    // Create client record linked to auth user
    const { data, error } = await supabaseAdmin
      .from("apartment_owners")
      .insert({
        auth_user_id: inviteData.user.id,
        name,
        email: normalizedEmail,
        phone,
        apartment_address,
        sex,
        age,
        apartment_classification,
        street_building,
        barangay,
        province,
        city_municipality,
        number_of_units,
        number_of_floors,
        number_of_rooms,
        other_property_details,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      // Cleanup: delete the auth user if client record fails
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(
      res,
      { ...data, requiresEmailVerification: true },
      "Client created successfully. Verification email sent.",
      201
    );
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/clients/:id
 * Update a client
 */
export async function updateClient(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

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

    sendSuccess(res, data, "Client updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/clients/:id
 * Delete a client
 */
export async function deleteClient(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("apartment_owners")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Client deleted successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/clients/count
 * Get total client count
 */
export async function getClientCount(
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
