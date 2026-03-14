import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

/**
 * GET /api/apartments
 * Get all apartments (optionally filtered by client_id or manager_id)
 */
export async function getApartments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("apartments")
      .select("*")
      .order("created_at", { ascending: false });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
    }
    if (req.query.manager_id) {
      query = query.eq("manager_id", req.query.manager_id as string);
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
 * GET /api/apartments/:id
 * Get a single apartment by ID
 */
export async function getApartmentById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("apartments")
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
 * POST /api/apartments
 * Create a new apartment (single)
 */
export async function createApartment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("apartments")
      .insert(req.body)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Apartment created successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/apartments/bulk
 * Create multiple apartments at once
 */
export async function createApartmentsBulk(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { apartments } = req.body;

    const { data, error } = await supabaseAdmin
      .from("apartments")
      .insert(apartments)
      .select();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, `${data.length} apartments created successfully`, 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/apartments/:id
 * Update an apartment
 */
export async function updateApartment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabaseAdmin
      .from("apartments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Apartment updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/apartments/:id
 * Delete an apartment (cascades tenant deletion on frontend)
 */
export async function deleteApartment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    // Soft-deactivate associated tenants first (preserve history)
    await supabaseAdmin
      .from("tenants")
      .update({
        status: "inactive",
        apartment_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("apartment_id", id);

    const { error } = await supabaseAdmin
      .from("apartments")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Apartment deleted successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/apartments/with-tenants
 * Get apartments with their active tenant info (for owner/manager unit views)
 */
export async function getApartmentsWithTenants(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("apartments")
      .select("*")
      .order("name", { ascending: true });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
    }
    if (req.query.manager_id) {
      query = query.eq("manager_id", req.query.manager_id as string);
    }

    const { data: apartments, error: aptError } = await query;

    if (aptError) {
      sendError(res, aptError.message, 500);
      return;
    }

    const aptIds = (apartments || []).map((a: any) => a.id);
    if (aptIds.length === 0) {
      sendSuccess(res, []);
      return;
    }

    // Get active tenants for these apartments
    const { data: tenants, error: tenError } = await supabaseAdmin
      .from("tenants")
      .select("id, name, phone, apartment_id")
      .eq("status", "active")
      .in("apartment_id", aptIds);

    if (tenError) {
      sendError(res, tenError.message, 500);
      return;
    }

    // Map tenant to apartment
    const tenantMap: Record<
      string,
      { id: string; name: string; phone: string | null }
    > = {};
    (tenants || []).forEach((t: any) => {
      if (t.apartment_id) {
        tenantMap[t.apartment_id] = {
          id: t.id,
          name: t.name,
          phone: t.phone,
        };
      }
    });

    const results = (apartments || []).map((apt: any) => ({
      id: apt.id,
      name: apt.name,
      address: apt.address,
      monthly_rent: Number(apt.monthly_rent) || 0,
      total_units: apt.total_units,
      client_id: apt.client_id,
      manager_id: apt.manager_id,
      status: apt.status,
      payment_due_day: apt.payment_due_day,
      created_at: apt.created_at,
      tenant_name: tenantMap[apt.id]?.name || null,
      tenant_phone: tenantMap[apt.id]?.phone || null,
      tenant_id: tenantMap[apt.id]?.id || null,
    }));

    sendSuccess(res, results);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/apartments/:id/payment-due-day
 * Set payment_due_day for an apartment (or all apartments under a client)
 */
export async function setPaymentDueDay(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { day, client_id } = req.body;

    if (client_id) {
      // Update all apartments for the given client
      const { error } = await supabaseAdmin
        .from("apartments")
        .update({ payment_due_day: day })
        .eq("client_id", client_id);

      if (error) {
        sendError(res, error.message, 500);
        return;
      }

      sendSuccess(res, null, "Payment due day updated for all apartments");
    } else {
      const { id } = req.params;
      const { data, error } = await supabaseAdmin
        .from("apartments")
        .update({ payment_due_day: day })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        sendError(res, error.message, 500);
        return;
      }

      sendSuccess(res, data, "Payment due day updated");
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/apartments/count
 * Get apartment count (optionally filtered by client_id)
 */
export async function getApartmentCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("apartments")
      .select("*", { count: "exact", head: true });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
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
