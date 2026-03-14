import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, generateRandomPassword } from "../utils/helpers";

/**
 * GET /api/tenants
 * Get all tenants (optionally filtered by apartment_id or client_id)
 */
export async function getTenants(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const clientId = req.query.client_id as string | undefined;
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

    if (req.query.apartment_id) {
      query = query.eq("apartment_id", req.query.apartment_id as string);
    }

    if (clientId) {
      const { data: apartments, error: apartmentsError } = await supabaseAdmin
        .from("apartments")
        .select("id")
        .eq("client_id", clientId);

      if (apartmentsError) {
        sendError(res, apartmentsError.message, 500);
        return;
      }

      const apartmentIds = (apartments || []).map((a: any) => a.id).filter(Boolean);

      if (apartmentIds.length > 0) {
        query = query.or(
          `client_id.eq.${clientId},apartment_id.in.(${apartmentIds.join(",")})`
        );
      } else {
        query = query.eq("client_id", clientId);
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
    const { name, email, phone, apartment_id, client_id, create_auth_account } =
      req.body;

    let authUserId: string | null = null;
    let generatedPassword: string | null = null;

    // Create auth account if requested
    if (create_auth_account && email) {
      const password = generateRandomPassword();
      generatedPassword = password;

      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { role: "tenant", name },
        });

      if (authError) {
        sendError(res, authError.message);
        return;
      }

      authUserId = authData.user.id;
    }

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .insert({
        auth_user_id: authUserId,
        name,
        email,
        phone,
        apartment_id,
        client_id,
        status: "active",
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
      { ...data, generatedPassword },
      "Tenant created successfully",
      201
    );
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

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .update({
        status: "inactive",
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
    const { unit_id, tenant_id, name, phone, monthly_rent } = req.body;

    // Get apartment to know client_id
    const { data: apt, error: aptErr } = await supabaseAdmin
      .from("apartments")
      .select("client_id")
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
      .eq("apartment_id", unit_id)
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
          apartment_id: unit_id,
          client_id: apt.client_id,
          status: "active",
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
          .update({ name, phone: phone || null })
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
          apartment_id: unit_id,
          client_id: apt.client_id,
          status: "active",
          move_in_date: new Date().toISOString().split("T")[0],
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
        .from("apartments")
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
    const { unit_id } = req.body;

    const { error } = await supabaseAdmin
      .from("tenants")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("apartment_id", unit_id)
      .eq("status", "active");

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Tenant removed from unit successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/tenants/count
 * Get tenant count (optionally filtered by client_id or apartment_id)
 */
export async function getTenantCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("tenants")
      .select("*", { count: "exact", head: true });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
    }
    if (req.query.apartment_id) {
      query = query.eq("apartment_id", req.query.apartment_id as string);
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
