import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { isValidEmailFormat } from "../utils/emailValidation";
import { logActivity } from "../utils/activityLog";

function getInviteRedirectUrl(): string {
  const normalizedBase = env.FRONTEND_URL.replace(/\/+$/, "");
  return normalizedBase.endsWith("/invite/confirm")
    ? normalizedBase
    : `${normalizedBase}/invite/confirm`;
}

/**
 * GET /api/managers
 * Get all managers (optionally filtered by apartmentowner_id)
 */
export async function getManagers(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("apartment_managers")
      .select("*")
      .order("created_at", { ascending: false });

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
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
      .from("apartment_managers")
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
      .from("apartment_managers")
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
    const { name, email, phone, apartmentowner_id, sex, age } = req.body;
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
      .from("apartment_managers")
      .insert({
        auth_user_id: inviteData.user.id,
        name,
        email: normalizedEmail,
        phone,
        sex: sex || null,
        age: age || null,
        apartmentowner_id,
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

    logActivity({
      apartmentowner_id,
      actor_id: req.user?.id || null,
      actor_name: req.user?.email || "System",
      actor_role: (req.user?.role as "owner" | "manager") || "owner",
      action: "manager_added",
      entity_type: "manager",
      entity_id: data.id,
      description: `Added manager ${name} (${normalizedEmail})`,
      metadata: { name, email: normalizedEmail, phone: phone || "" },
    });
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

    // Fetch old record for diff logging
    const { data: oldRecord } = await supabaseAdmin
      .from("apartment_managers")
      .select("*")
      .eq("id", id)
      .single();

    const { data, error } = await supabaseAdmin
      .from("apartment_managers")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Manager updated successfully");

    if (oldRecord && data) {
      const changes: Record<string, { from: string; to: string }> = {};
      for (const key of Object.keys(updates)) {
        const oldVal = String(oldRecord[key] ?? "");
        const newVal = String(data[key] ?? "");
        if (oldVal !== newVal) changes[key] = { from: oldVal, to: newVal };
      }
      if (Object.keys(changes).length > 0) {
        logActivity({
          apartmentowner_id: data.apartmentowner_id,
          actor_id: req.user?.id || null,
          actor_name: req.user?.email || "System",
          actor_role: (req.user?.role as "owner" | "manager") || "owner",
          action: "manager_updated",
          entity_type: "manager",
          entity_id: id,
          description: `Updated manager ${data.name}`,
          metadata: { changes },
        });
      }
    }
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

    // Fetch record before deletion for logging
    const { data: manager } = await supabaseAdmin
      .from("apartment_managers")
      .select("name, apartmentowner_id")
      .eq("id", id)
      .single();

    const { error } = await supabaseAdmin
      .from("apartment_managers")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Manager deleted successfully");

    if (manager) {
      logActivity({
        apartmentowner_id: manager.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: req.user?.email || "System",
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "manager_removed",
        entity_type: "manager",
        entity_id: id,
        description: `Removed manager ${manager.name}`,
      });
    }
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
      .from("apartment_managers")
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
