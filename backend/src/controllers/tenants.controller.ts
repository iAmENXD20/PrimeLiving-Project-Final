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
      req.query.include_inactive === "true" || requesterRole === "admin";
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
      .eq("status", "active")
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
    const { name, email, phone, unit_id, apartmentowner_id, create_auth_account, sex, age } =
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
          data: { role: "tenant", name },
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
        name,
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
      actor_name: req.user?.email || "System",
      actor_role: (req.user?.role as "owner" | "manager") || "owner",
      action: "tenant_added",
      entity_type: "tenant",
      entity_id: data.id,
      description: `Added tenant ${name}${normalizedEmail ? ` (${normalizedEmail})` : ""}`,
      metadata: { name, email: normalizedEmail || "", phone: phone || "" },
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
        logActivity({
          apartmentowner_id: data.apartmentowner_id,
          actor_id: req.user?.id || null,
          actor_name: req.user?.email || "System",
          actor_role: (req.user?.role as "owner" | "manager") || "owner",
          action: "tenant_updated",
          entity_type: "tenant",
          entity_id: id,
          description: `Updated tenant ${data.name}`,
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
      .select("name, apartmentowner_id")
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
      logActivity({
        apartmentowner_id: tenant.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: req.user?.email || "System",
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "tenant_removed",
        entity_type: "tenant",
        entity_id: id,
        description: `Removed tenant ${tenant.name}`,
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
    const { unit_id, tenant_id, name, phone, monthly_rent, start_at } = req.body;
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
    } else if (name) {
      if (existing) {
        // Update existing tenant's info
        const { error } = await supabaseAdmin
          .from("tenants")
          .update({ name, phone: phone || null, move_in_date: resolvedStartDate })
          .eq("id", existing.id);
        if (error) {
          sendError(res, error.message, 500);
          return;
        }
      } else {
        // Create new tenant
        const { error } = await supabaseAdmin.from("tenants").insert({
          name,
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
