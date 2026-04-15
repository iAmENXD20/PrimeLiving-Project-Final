import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, getManagerScope } from "../utils/helpers";
import { isValidEmailFormat } from "../utils/emailValidation";
import { logActivity, resolveActorName } from "../utils/activityLog";
import { createNotification } from "../utils/notifications";

function getInviteRedirectUrl(): string {
  return env.FRONTEND_URL.replace(/\/+$/, "") + "/invite/confirm";
}

/**
 * GET /api/tenants
 * Get all tenants (optionally filtered by unit_id or apartmentowner_id)
 */
export async function getTenants(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const apartmentownerId = req.query.apartmentowner_id as string | undefined;
    const requesterRole = req.user?.role;
    const includeInactive =
      req.query.include_inactive === "true" || requesterRole === "owner";
    let query = supabaseAdmin
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false });

    if (!includeInactive) {
      query = query.neq("status", "inactive");
    }

    if (req.query.unit_id) {
      query = query.eq("unit_id", req.query.unit_id as string);
    }

    if (apartmentownerId) {
      const { data: apartments, error: apartmentsError } = await supabaseAdmin
        .from("units")
        .select("id")
        .eq("apartmentowner_id", apartmentownerId);

      if (apartmentsError) {
        sendError(res, apartmentsError.message, 500);
        return;
      }

      const apartmentIds = (apartments || []).map((a: any) => a.id).filter(Boolean);

      if (apartmentIds.length > 0) {
        query = query.or(
          `apartmentowner_id.eq.${apartmentownerId},unit_id.in.(${apartmentIds.join(",")})`
        );
      } else {
        query = query.eq("apartmentowner_id", apartmentownerId);
      }
    }

    if (req.query.manager_id) {
      const { unitIds } = await getManagerScope(req.query.manager_id as string);

      // Also get the manager's owner to include unassigned tenants
      const { data: mgr } = await supabaseAdmin
        .from("apartment_managers")
        .select("apartmentowner_id")
        .eq("id", req.query.manager_id as string)
        .single();

      const ownerId = mgr?.apartmentowner_id;

      if (unitIds.length === 0 && !ownerId) {
        sendSuccess(res, []);
        return;
      }

      // Include tenants assigned to the manager's units OR unassigned tenants belonging to the same owner
      const orParts: string[] = [];
      if (unitIds.length > 0) {
        orParts.push(`unit_id.in.(${unitIds.join(",")})`);
      }
      if (ownerId) {
        orParts.push(`apartmentowner_id.eq.${ownerId}`);
      }
      query = query.or(orParts.join(","));
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
 * GET /api/tenants/:id
 * Get a single tenant by ID
 */
export async function getTenantById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("tenants")
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
 * GET /api/tenants/by-auth/:authUserId
 * Get a tenant by auth_user_id
 */
export async function getTenantByAuthId(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { authUserId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .select("*")
      .eq("auth_user_id", authUserId)
      .in("status", ["active", "pending_verification"])
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
 * POST /api/tenants
 * Create a new tenant (optionally creates Supabase Auth account)
 */
export async function createTenant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { first_name, last_name, email, phone, unit_id, apartmentowner_id, create_auth_account, sex, age } =
      req.body;
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : null;

    let authUserId: string | null = null;

    if (normalizedEmail) {
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
    }

    // Create auth account if requested
    if (create_auth_account) {
      if (!normalizedEmail) {
        sendError(res, "Email is required when creating a tenant auth account", 400);
        return;
      }

      const { data: inviteData, error: authError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
          redirectTo: getInviteRedirectUrl(),
          data: { role: "tenant", name: `${first_name} ${last_name}`.trim(), login_email: normalizedEmail },
        });

      if (authError) {
        sendError(res, authError.message);
        return;
      }

      if (!inviteData.user?.id) {
        sendError(res, "Failed to create tenant auth account", 500);
        return;
      }

      authUserId = inviteData.user.id;
    }

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .insert({
        auth_user_id: authUserId,
        first_name,
        last_name: last_name || '',
        email: normalizedEmail,
        phone,
        sex: sex || null,
        age: age || null,
        unit_id,
        apartmentowner_id,
        status: create_auth_account ? "pending" : "active",
        move_in_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (error) {
      // Cleanup auth user if tenant record creation fails
      if (authUserId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(
      res,
      { ...data, invitationEmailSent: Boolean(create_auth_account && normalizedEmail) },
      "Tenant created successfully",
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
      action: "tenant_added",
      entity_type: "tenant",
      entity_id: data.id,
      description: `Added tenant ${first_name} ${last_name}`.trim() + `${normalizedEmail ? ` (${normalizedEmail})` : ""}`,
      metadata: { first_name, last_name, email: normalizedEmail || "", phone: phone || "" },
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/tenants/:id
 * Update a tenant
 */
export async function updateTenant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Fetch old record for diff logging
    const { data: oldRecord } = await supabaseAdmin
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Tenant updated successfully");

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
          action: "tenant_updated",
          entity_type: "tenant",
          entity_id: id,
          description: `Updated tenant ${data.first_name} ${data.last_name}`.trim(),
          metadata: { changes },
        });
      }
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/tenants/:id
 * Soft-delete a tenant (set inactive, preserve data for admin/history)
 */
export async function deleteTenant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    // Fetch record before soft-delete for logging
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("first_name, last_name, apartmentowner_id")
      .eq("id", id)
      .single();

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .update({
        status: "inactive",
        unit_id: null,
        apartment_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id");

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    if (!data || data.length === 0) {
      sendError(res, "Tenant not found", 404);
      return;
    }

    sendSuccess(res, null, "Tenant deactivated successfully");

    if (tenant) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: tenant.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "tenant_removed",
        entity_type: "tenant",
        entity_id: id,
        description: `Removed tenant ${tenant.first_name} ${tenant.last_name}`.trim(),
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/tenants/assign-unit
 * Assign a tenant to a unit (apartment). Deactivates any existing active tenant.
 */
export async function assignTenantToUnit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { unit_id, tenant_id, first_name, last_name, phone, monthly_rent, start_at } = req.body;
    const resolvedStartDate =
      typeof start_at === "string" && start_at.trim().length > 0
        ? start_at.trim()
        : new Date().toISOString().split("T")[0];

    const parsedStartDate = new Date(`${resolvedStartDate}T00:00:00`);
    if (Number.isNaN(parsedStartDate.getTime())) {
      sendError(res, "start_at must be a valid date (YYYY-MM-DD)", 400);
      return;
    }

    // Get apartment to know apartmentowner_id
    const { data: apt, error: aptErr } = await supabaseAdmin
      .from("units")
      .select("apartmentowner_id")
      .eq("id", unit_id)
      .single();

    if (aptErr || !apt) {
      sendError(res, "Unit not found", 404);
      return;
    }

    // Check if unit already has an active tenant
    const { data: existing } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("unit_id", unit_id)
      .eq("status", "active")
      .maybeSingle();

    if (tenant_id) {
      if (existing && existing.id !== tenant_id) {
        const { error: deactivateError } = await supabaseAdmin
          .from("tenants")
          .update({ status: "inactive", updated_at: new Date().toISOString() })
          .eq("id", existing.id);

        if (deactivateError) {
          sendError(res, deactivateError.message, 500);
          return;
        }
      }

      const { data: selectedTenant, error: selectedTenantError } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("id", tenant_id)
        .maybeSingle();

      if (selectedTenantError) {
        sendError(res, selectedTenantError.message, 500);
        return;
      }

      if (!selectedTenant) {
        sendError(res, "Selected tenant account not found", 404);
        return;
      }

      const { error: assignError } = await supabaseAdmin
        .from("tenants")
        .update({
          unit_id: unit_id,
          apartmentowner_id: apt.apartmentowner_id,
          status: "active",
          move_in_date: resolvedStartDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant_id);

      if (assignError) {
        sendError(res, assignError.message, 500);
        return;
      }
    } else if (first_name) {
      if (existing) {
        // Update existing tenant's info
        const { error } = await supabaseAdmin
          .from("tenants")
          .update({ first_name, last_name: last_name || '', phone: phone || null, move_in_date: resolvedStartDate })
          .eq("id", existing.id);
        if (error) {
          sendError(res, error.message, 500);
          return;
        }
      } else {
        // Create new tenant
        const { error } = await supabaseAdmin.from("tenants").insert({
          first_name,
          last_name: last_name || '',
          phone: phone || null,
          unit_id: unit_id,
          apartmentowner_id: apt.apartmentowner_id,
          status: "active",
          move_in_date: resolvedStartDate,
        });
        if (error) {
          sendError(res, error.message, 500);
          return;
        }
      }
    } else {
      sendError(res, "tenant_id or tenant name is required", 400);
      return;
    }

    // Update rent if provided
    if (monthly_rent !== undefined) {
      await supabaseAdmin
        .from("units")
        .update({ monthly_rent, updated_at: new Date().toISOString() })
        .eq("id", unit_id);
    }

    sendSuccess(res, null, "Tenant assigned to unit successfully");

    if (apt?.apartmentowner_id) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: apt.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "tenant_assigned_to_unit",
        entity_type: "tenant",
        entity_id: tenant_id || null,
        description: `Assigned tenant ${first_name ? `${first_name} ${last_name || ''}`.trim() : tenant_id} to unit`,
        metadata: { unit_id, tenant_id, first_name, last_name, start_at: resolvedStartDate },
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/tenants/remove-from-unit
 * Remove (deactivate) the active tenant from a unit
 */
export async function removeTenantFromUnit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { unit_id, preserve_account } = req.body;

    if (!unit_id) {
      sendError(res, "unit_id is required", 400);
      return;
    }

    const { data: assignedTenants, error: lookupError } = await supabaseAdmin
      .from("tenants")
      .select("id, status")
      .eq("unit_id", unit_id)
      .neq("status", "inactive");

    if (lookupError) {
      sendError(res, lookupError.message, 500);
      return;
    }

    if (!assignedTenants || assignedTenants.length === 0) {
      sendError(res, "No assigned tenant found for this unit", 404);
      return;
    }

    const tenantIds = assignedTenants.map((tenant: any) => tenant.id);

    const updates = preserve_account
      ? {
          unit_id: null,
          apartment_id: null,
          updated_at: new Date().toISOString(),
        }
      : {
          status: "inactive",
          unit_id: null,
          apartment_id: null,
          updated_at: new Date().toISOString(),
        };

    const { error } = await supabaseAdmin
      .from("tenants")
      .update(updates)
      .in("id", tenantIds);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(
      res,
      null,
      preserve_account
        ? "Tenant account preserved and unit emptied successfully"
        : "Tenant removed from unit successfully"
    );

    // Fetch unit to get apartmentowner_id for logging
    const { data: unitForLog } = await supabaseAdmin
      .from("units")
      .select("apartmentowner_id")
      .eq("id", unit_id)
      .maybeSingle();

    if (unitForLog?.apartmentowner_id) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: unitForLog.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: preserve_account ? "tenant_unassigned_from_unit" : "tenant_removed_from_unit",
        entity_type: "tenant",
        entity_id: tenantIds[0] || null,
        description: preserve_account
          ? `Unassigned tenant from unit (account preserved)`
          : `Removed tenant from unit`,
        metadata: { unit_id, tenant_ids: tenantIds, preserve_account },
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/tenants/count
 * Get tenant count (optionally filtered by apartmentowner_id or unit_id)
 */
export async function getTenantCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("tenants")
      .select("*", { count: "exact", head: true });

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
    }
    if (req.query.unit_id) {
      query = query.eq("unit_id", req.query.unit_id as string);
    }

    const { count, error } = await query;

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
 * PUT /api/tenants/confirm-activation
 * After user sets password, change status from 'pending' to 'pending_verification'
 * and save ID verification data. Works for both managers and tenants.
 */
export async function confirmActivation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) {
      sendError(res, "Unauthorized", 401);
      return;
    }

    const { id_type, id_type_other, id_front_photo_url, id_back_photo_url } = req.body;

    // Try tenant first
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, status, apartmentowner_id")
      .eq("auth_user_id", authUserId)
      .eq("status", "pending")
      .maybeSingle();

    if (tenant) {
      const { error: updateError } = await supabaseAdmin
        .from("tenants")
        .update({
          status: "pending_verification",
          id_type: id_type || null,
          id_type_other: id_type_other || null,
          id_front_photo_url: id_front_photo_url || null,
          id_back_photo_url: id_back_photo_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenant.id);

      if (updateError) {
        sendError(res, updateError.message, 500);
        return;
      }

      sendSuccess(res, null, "Account is now pending verification");
      return;
    }

    // Try manager
    const { data: manager, error: managerError } = await supabaseAdmin
      .from("apartment_managers")
      .select("id, status, apartmentowner_id")
      .eq("auth_user_id", authUserId)
      .eq("status", "pending")
      .maybeSingle();

    if (manager) {
      const { error: updateError } = await supabaseAdmin
        .from("apartment_managers")
        .update({
          status: "pending_verification",
          id_type: id_type || null,
          id_type_other: id_type_other || null,
          id_front_photo_url: id_front_photo_url || null,
          id_back_photo_url: id_back_photo_url || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", manager.id);

      if (updateError) {
        sendError(res, updateError.message, 500);
        return;
      }

      sendSuccess(res, null, "Account is now pending verification");
      return;
    }

    sendError(res, "Account not found or already activated", 404);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/tenants/:id/approve
 * Owner approves tenant — changes status from 'pending_verification' to 'active'
 */
export async function approveTenant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data: tenant, error: findError } = await supabaseAdmin
      .from("tenants")
      .select("id, status, first_name, last_name, apartmentowner_id")
      .eq("id", id)
      .single();

    if (findError || !tenant) {
      sendError(res, "Tenant not found", 404);
      return;
    }

    if (tenant.status !== "pending_verification" && tenant.status !== "pending") {
      sendError(res, "Tenant is not pending verification", 400);
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from("tenants")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      sendError(res, updateError.message, 500);
      return;
    }

    sendSuccess(res, null, "Tenant approved successfully");

    if (tenant.apartmentowner_id) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: tenant.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "tenant_approved",
        entity_type: "tenant",
        entity_id: tenant.id,
        description: `Approved tenant account: ${tenant.first_name} ${tenant.last_name}`.trim(),
        metadata: { tenant_id: tenant.id },
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/tenants/:id/id-photos
 * Get signed URLs for a tenant's uploaded ID photos
 */
export async function getTenantIdPhotos(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .select("id_type, id_type_other, id_front_photo_url, id_back_photo_url")
      .eq("id", id)
      .single();

    if (error || !tenant) {
      sendError(res, "Tenant not found", 404);
      return;
    }

    let frontUrl = null;
    let backUrl = null;

    if (tenant.id_front_photo_url) {
      const { data } = await supabaseAdmin.storage
        .from("verification-ids")
        .createSignedUrl(tenant.id_front_photo_url, 300);
      frontUrl = data?.signedUrl || null;
    }

    if (tenant.id_back_photo_url) {
      const { data } = await supabaseAdmin.storage
        .from("verification-ids")
        .createSignedUrl(tenant.id_back_photo_url, 300);
      backUrl = data?.signedUrl || null;
    }

    sendSuccess(res, {
      id_type: tenant.id_type,
      id_type_other: tenant.id_type_other,
      front_url: frontUrl,
      back_url: backUrl,
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/tenants/check-lease-expiry
 * Check for expiring leases and notify tenants.
 * Called on dashboard load. Idempotent — skips if notification already sent today.
 */
export async function checkLeaseExpiry(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const ownerId = req.query.apartmentowner_id as string;
    if (!ownerId) {
      sendError(res, "apartmentowner_id is required", 400);
      return;
    }

    // Batch: Get all active units with lease_end + their active tenants in 2 queries
    const [unitsResult, tenantsResult] = await Promise.all([
      supabaseAdmin
        .from("units")
        .select("id, name, lease_end, lease_start, contract_duration, monthly_rent, apartmentowner_id")
        .eq("apartmentowner_id", ownerId)
        .not("lease_end", "is", null)
        .eq("status", "active"),
      supabaseAdmin
        .from("tenants")
        .select("id, first_name, last_name, contract_status, unit_id")
        .eq("apartmentowner_id", ownerId)
        .eq("status", "active"),
    ]);

    const units = unitsResult.data;
    if (unitsResult.error || !units || !units.length) {
      sendSuccess(res, { checked: 0, notified: 0 });
      return;
    }

    // Build tenant lookup by unit_id (single pass)
    const tenantByUnit = new Map<string, typeof tenantsResult.data extends (infer T)[] ? T : never>();
    for (const t of tenantsResult.data || []) {
      if (t.unit_id) tenantByUnit.set(t.unit_id, t);
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    let notified = 0;

    // Pre-filter units that need processing
    const relevantUnits = units.filter((unit) => {
      const tenant = tenantByUnit.get(unit.id);
      if (!tenant || tenant.contract_status === "renewed") return false;
      const daysUntilExpiry = Math.ceil((new Date(unit.lease_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (tenant.contract_status === "end_contract") return daysUntilExpiry <= 0 || [7, 3, 1].includes(daysUntilExpiry);
      return daysUntilExpiry <= 30 && !(daysUntilExpiry > 15 && daysUntilExpiry < 30);
    });

    if (!relevantUnits.length) {
      sendSuccess(res, { checked: units.length, notified: 0 });
      return;
    }

    // Batch: check today's notifications for all relevant tenants in 1 query
    const relevantTenantIds = relevantUnits.map((u) => tenantByUnit.get(u.id)!.id);
    const { data: todayNotifs } = await supabaseAdmin
      .from("notifications")
      .select("id, recipient_id, type")
      .in("recipient_id", relevantTenantIds)
      .in("type", ["lease_expiring", "contract_ending_countdown"])
      .gte("created_at", today + "T00:00:00")
      .lte("created_at", today + "T23:59:59");

    // Build set of "tenantId:type" for quick lookup
    const notifiedToday = new Set(
      (todayNotifs || []).map((n) => `${n.recipient_id}:${n.type}`)
    );

    // Process each relevant unit (only write operations remain)
    for (const unit of relevantUnits) {
      const tenant = tenantByUnit.get(unit.id)!;
      const leaseEnd = new Date(unit.lease_end);
      const daysUntilExpiry = Math.ceil((leaseEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Auto-close tenant on contract expiry if they chose to end contract
      if (daysUntilExpiry <= 0 && tenant.contract_status === "end_contract") {
        await supabaseAdmin
          .from("tenants")
          .update({ contract_status: "closed", status: "inactive" })
          .eq("id", tenant.id);

        await createNotification({
          apartmentowner_id: unit.apartmentowner_id,
          recipient_role: "tenant",
          recipient_id: tenant.id,
          type: "contract_ended",
          title: "Contract Ended",
          message: `Your contract for ${unit.name} has ended. Your account is now closed.`,
          unit_id: unit.id,
        });
        continue;
      }

      // Tenant chose to end contract — send countdown warnings at 7, 3, 1 days
      if (tenant.contract_status === "end_contract") {
        if (notifiedToday.has(`${tenant.id}:contract_ending_countdown`)) continue;

        await createNotification({
          apartmentowner_id: unit.apartmentowner_id,
          recipient_role: "tenant",
          recipient_id: tenant.id,
          type: "contract_ending_countdown",
          title: "Account Closing Soon",
          message: `Your account will be closed in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}. After contract ends, your account will no longer be accessible.`,
          unit_id: unit.id,
        });
        notified++;
        continue;
      }

      // Regular expiry notifications — skip if already sent today
      if (notifiedToday.has(`${tenant.id}:lease_expiring`)) continue;

      // Update tenant contract_status to 'expiring' if not already
      if (tenant.contract_status !== "expiring") {
        await supabaseAdmin
          .from("tenants")
          .update({ contract_status: "expiring" })
          .eq("id", tenant.id);
      }

      const message =
        daysUntilExpiry <= 0
          ? `Your contract for ${unit.name} has expired. Please contact your apartment manager to discuss renewal.`
          : `Your contract for ${unit.name} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"} (${unit.lease_end}). Please contact your apartment manager if you wish to renew.`;

      await createNotification({
        apartmentowner_id: unit.apartmentowner_id,
        recipient_role: "tenant",
        recipient_id: tenant.id,
        type: "lease_expiring",
        title: daysUntilExpiry <= 0 ? "Contract Expired" : "Contract Expiring Soon",
        message,
        unit_id: unit.id,
      });

      notified++;
    }

    sendSuccess(res, { checked: units.length, notified });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/tenants/:id/renew
 * Tenant requests contract renewal.
 */
export async function renewTenantContract(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data: tenant, error: fetchErr } = await supabaseAdmin
      .from("tenants")
      .select("id, first_name, last_name, unit_id, apartmentowner_id, renewal_count")
      .eq("id", id)
      .single();

    if (fetchErr || !tenant) {
      sendError(res, "Tenant not found", 404);
      return;
    }

    const { error } = await supabaseAdmin
      .from("tenants")
      .update({
        contract_status: "renewed",
        renewal_date: new Date().toISOString().slice(0, 10),
        renewal_count: (tenant.renewal_count || 0) + 1,
      })
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    // Notify the manager about the renewal
    if (tenant.unit_id) {
      const { data: unit } = await supabaseAdmin
        .from("units")
        .select("manager_id, name")
        .eq("id", tenant.unit_id)
        .maybeSingle();

      if (unit?.manager_id) {
        await createNotification({
          apartmentowner_id: tenant.apartmentowner_id,
          recipient_role: "manager",
          recipient_id: unit.manager_id,
          type: "lease_renewed",
          title: "Tenant Contract Renewed",
          message: `${tenant.first_name} ${tenant.last_name} has renewed their contract for ${unit.name}.`,
          unit_id: tenant.unit_id,
        });
      }

      // Log to owner's activity logs (Recent Histories)
      logActivity({
        apartmentowner_id: tenant.apartmentowner_id,
        actor_id: id,
        actor_name: `${tenant.first_name} ${tenant.last_name}`,
        actor_role: "tenant",
        action: "contract_renewed",
        entity_type: "tenant",
        entity_id: id,
        description: `${tenant.first_name} ${tenant.last_name} renewed their contract for ${unit?.name || "a unit"}`,
        metadata: { unit_id: tenant.unit_id, tenant_id: id, first_name: tenant.first_name, last_name: tenant.last_name },
      });
    }

    sendSuccess(res, { renewed: true }, "Contract renewed successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/tenants/:id/end-contract
 * Tenant chooses not to renew — triggers countdown notifications
 */
export async function endTenantContract(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data: tenant, error: fetchErr } = await supabaseAdmin
      .from("tenants")
      .select("id, first_name, last_name, unit_id, apartmentowner_id")
      .eq("id", id)
      .single();

    if (fetchErr || !tenant) {
      sendError(res, "Tenant not found", 404);
      return;
    }

    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ contract_status: "end_contract" })
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    // Notify manager
    if (tenant.unit_id) {
      const { data: unit } = await supabaseAdmin
        .from("units")
        .select("manager_id, name")
        .eq("id", tenant.unit_id)
        .maybeSingle();

      if (unit?.manager_id) {
        await createNotification({
          apartmentowner_id: tenant.apartmentowner_id,
          recipient_role: "manager",
          recipient_id: unit.manager_id,
          type: "contract_ended",
          title: "Tenant Ending Contract",
          message: `${tenant.first_name} ${tenant.last_name} has decided to end their contract for ${unit.name}.`,
          unit_id: tenant.unit_id,
        });
      }

      // Log to owner's activity logs
      logActivity({
        apartmentowner_id: tenant.apartmentowner_id,
        actor_id: id,
        actor_name: `${tenant.first_name} ${tenant.last_name}`,
        actor_role: "tenant",
        action: "contract_ended",
        entity_type: "tenant",
        entity_id: id,
        description: `${tenant.first_name} ${tenant.last_name} chose to end their contract for ${unit?.name || "a unit"}`,
        metadata: { unit_id: tenant.unit_id, tenant_id: id, first_name: tenant.first_name, last_name: tenant.last_name },
      });
    }

    sendSuccess(res, { ended: true }, "Contract end request recorded");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
