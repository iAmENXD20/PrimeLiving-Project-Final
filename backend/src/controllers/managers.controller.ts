import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { isValidEmailFormat } from "../utils/emailValidation";

function getInviteRedirectUrl(): string {
  const normalizedBase = env.FRONTEND_URL.replace(/\/+$/, "");
  return normalizedBase.endsWith("/invite/confirm")
    ? normalizedBase
    : `${normalizedBase}/invite/confirm`;
}

/**
 * GET /api/managers
 * Get all managers (optionally filtered by client_id)
 */
export async function getManagers(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("managers")
      .select("*")
      .order("created_at", { ascending: false });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
    }

    const { data, error } = await query;

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
 * GET /api/managers/:id
 * Get a single manager by ID
 */
export async function getManagerById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("managers")
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
 * GET /api/managers/by-auth/:authUserId
 * Get a manager by auth_user_id
 */
export async function getManagerByAuthId(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { authUserId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("managers")
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
 * POST /api/managers
 * Create a new manager (also creates Supabase Auth account)
 */
export async function createManager(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { name, email, phone, client_id } = req.body;
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
      supabaseAdmin.from("clients").select("id").eq("email", normalizedEmail).maybeSingle(),
      supabaseAdmin.from("managers").select("id").eq("email", normalizedEmail).maybeSingle(),
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

    const { data: inviteData, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo: getInviteRedirectUrl(),
        data: { role: "manager", name },
      });

    if (authError) {
      sendError(res, authError.message);
      return;
    }

    if (!inviteData.user?.id) {
      sendError(res, "Failed to create manager auth account", 500);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("managers")
      .insert({
        auth_user_id: inviteData.user.id,
        name,
        email: normalizedEmail,
        phone,
        client_id,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(
      res,
      {
        ...data,
        invitationEmailSent: true,
      },
      "Manager created successfully",
      201
    );
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/managers/:id
 * Update a manager
 */
export async function updateManager(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabaseAdmin
      .from("managers")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Manager updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/managers/:id
 * Delete a manager
 */
export async function deleteManager(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("managers")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Manager deleted successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/managers/count
 * Get total manager count
 */
export async function getManagerCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { count, error } = await supabaseAdmin
      .from("managers")
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
