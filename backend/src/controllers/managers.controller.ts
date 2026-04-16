import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, invalidateManagerScope } from "../utils/helpers";
import { withAdminRetry } from "../utils/adminRetry";
import { isValidEmailFormat } from "../utils/emailValidation";
import { logActivity, resolveActorName } from "../utils/activityLog";
import { sendEmail, accountApprovedEmailHtml } from "../utils/email";
import { createNotification } from "../utils/notifications";

function getInviteRedirectUrl(): string {
  return env.FRONTEND_URL.replace(/\/+$/, "") + "/invite/confirm";
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
      .select("*, apartment:apartments!apartment_id(id, name, address)")
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

    const { data, error } = await withAdminRetry((client) =>
      client
        .from("apartment_managers")
        .select("*")
        .eq("auth_user_id", authUserId)
        .single()
    );

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
    const { firstName, lastName, email, phone, apartmentowner_id, sex, age, apartment_id } = req.body;
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
        data: { role: "manager", name: `${firstName} ${lastName}`.trim(), login_email: normalizedEmail },
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
        first_name: firstName,
        last_name: lastName || '',
        email: normalizedEmail,
        phone,
        sex: sex || null,
        age: age || null,
        apartmentowner_id,
        apartment_id: apartment_id || null,
        status: "pending",
      })
      .select("*, apartment:apartments!apartment_id(id, name, address)")
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
      actor_name: await (async () => {
        if (req.user?.id) return resolveActorName(req.user.id, req.user.role, req.user.email);
        return "System";
      })(),
      actor_role: (req.user?.role as "owner" | "manager") || "owner",
      action: "manager_added",
      entity_type: "manager",
      entity_id: data.id,
      description: `Added manager ${firstName} ${lastName} (${normalizedEmail})`,
      metadata: { firstName, lastName, email: normalizedEmail, phone: phone || "" },
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
      .select("*, apartment:apartments!apartment_id(id, name, address)")
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    // Invalidate cached manager scope when apartment assignment changes
    if ("apartment_id" in updates) {
      invalidateManagerScope(id);
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
        const actorName = req.user?.id
          ? await resolveActorName(req.user.id, req.user.role, req.user.email)
          : "System";
        logActivity({
          apartmentowner_id: data.apartmentowner_id,
          actor_id: req.user?.id || null,
          actor_name: actorName,
          actor_role: (req.user?.role as "owner" | "manager") || "owner",
          action: "manager_updated",
          entity_type: "manager",
          entity_id: id,
          description: `Updated manager ${data.first_name} ${data.last_name}`,
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
 * Soft-delete a manager (set status to inactive, preserve data for history)
 */
export async function deleteManager(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    // Fetch record before soft-delete for logging
    const { data: manager } = await supabaseAdmin
      .from("apartment_managers")
      .select("first_name, last_name, apartmentowner_id")
      .eq("id", id)
      .single();

    const { error } = await supabaseAdmin
      .from("apartment_managers")
      .update({ status: "inactive" })
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    // Clean up cached scope for the deleted manager
    invalidateManagerScope(id);

    sendSuccess(res, null, "Manager deactivated successfully");

    if (manager) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: manager.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "manager_removed",
        entity_type: "manager",
        entity_id: id,
        description: `Removed manager ${manager.first_name} ${manager.last_name}`,
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/managers/:id/resend-invite
 * Resend the invitation email for a pending manager
 */
export async function resendManagerInvite(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data: manager, error: fetchError } = await supabaseAdmin
      .from("apartment_managers")
      .select("auth_user_id, email, first_name, last_name, status")
      .eq("id", id)
      .single();

    if (fetchError || !manager) {
      sendError(res, "Manager not found", 404);
      return;
    }

    if (!manager.auth_user_id) {
      sendError(res, "Manager has no auth account", 400);
      return;
    }

    // Delete old auth user and re-invite with a fresh token
    await supabaseAdmin.auth.admin.deleteUser(manager.auth_user_id);

    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(manager.email, {
        redirectTo: getInviteRedirectUrl(),
        data: { role: "manager", name: `${manager.first_name} ${manager.last_name}`.trim(), login_email: manager.email },
      });

    if (inviteError || !inviteData.user?.id) {
      sendError(res, inviteError?.message || "Failed to resend invite", 500);
      return;
    }

    // Update auth_user_id to the new one
    await supabaseAdmin
      .from("apartment_managers")
      .update({ auth_user_id: inviteData.user.id, status: "pending", updated_at: new Date().toISOString() })
      .eq("id", id);

    sendSuccess(res, { invitationEmailSent: true }, "Invitation resent successfully");
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

/**
 * GET /api/managers/:id/id-photos
 * Get signed URLs for a manager's uploaded ID photos
 */
export async function getManagerIdPhotos(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data: manager, error } = await supabaseAdmin
      .from("apartment_managers")
      .select("id_type, id_type_other, id_front_photo_url, id_back_photo_url")
      .eq("id", id)
      .single();

    if (error || !manager) {
      sendError(res, "Manager not found", 404);
      return;
    }

    let frontUrl = null;
    let backUrl = null;

    const [frontResult, backResult] = await Promise.all([
      manager.id_front_photo_url
        ? supabaseAdmin.storage.from("verification-ids").createSignedUrl(manager.id_front_photo_url, 300)
        : Promise.resolve({ data: null }),
      manager.id_back_photo_url
        ? supabaseAdmin.storage.from("verification-ids").createSignedUrl(manager.id_back_photo_url, 300)
        : Promise.resolve({ data: null }),
    ]);
    frontUrl = frontResult.data?.signedUrl || null;
    backUrl = backResult.data?.signedUrl || null;

    sendSuccess(res, {
      id_type: manager.id_type,
      id_type_other: manager.id_type_other,
      front_url: frontUrl,
      back_url: backUrl,
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/managers/:id/approve
 * Approve a manager's account (set status from pending_verification to active)
 */
export async function approveManager(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data: manager, error: fetchError } = await supabaseAdmin
      .from("apartment_managers")
      .select("id, status, email, first_name, last_name, apartmentowner_id, apartment_id")
      .eq("id", id)
      .single();

    if (fetchError || !manager) {
      sendError(res, "Manager not found", 404);
      return;
    }

    if (manager.status !== "pending_verification" && manager.status !== "pending") {
      sendError(res, "Manager is not awaiting approval", 400);
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from("apartment_managers")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      sendError(res, updateError.message, 500);
      return;
    }

    sendSuccess(res, null, "Manager approved successfully");

    // Send approval email (non-blocking)
    const managerName = `${manager.first_name || ""} ${manager.last_name || ""}`.trim() || "Manager";
    if (manager.email) {
      sendEmail({
        to: manager.email,
        subject: "Your PrimeLiving Account Has Been Approved",
        html: accountApprovedEmailHtml({ name: managerName, role: "manager" }),
      }).catch((err) => console.error("[ApproveManager] Email failed:", err));
    }

    // Create in-app notification (non-blocking)
    if (manager.apartmentowner_id) {
      createNotification({
        apartmentowner_id: manager.apartmentowner_id,
        recipient_role: "manager",
        recipient_id: manager.id,
        type: "account_approved",
        title: "Account Approved",
        message: "Your account has been verified and approved. You can now access all manager features.",
        apartment_id: manager.apartment_id || null,
      }).catch((err) => console.error("[ApproveManager] Notification failed:", err));
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
