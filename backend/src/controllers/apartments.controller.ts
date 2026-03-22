import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { logActivity, resolveActorName } from "../utils/activityLog";

async function getOrCreateApartmentForClient(
  apartmentownerId: string,
  nameHint?: string | null,
  addressHint?: string | null
): Promise<string | null> {
  if (!apartmentownerId) {
    return null;
  }

  const { data: existing } = await supabaseAdmin
    .from("apartments")
    .select("id")
    .eq("apartmentowner_id", apartmentownerId)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const { data: created, error } = await supabaseAdmin
    .from("apartments")
    .insert({
      apartmentowner_id: apartmentownerId,
      name: nameHint || "Apartment",
      address: addressHint || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return created?.id || null;
}

function withFlatAddress(unit: any) {
  const address = unit?.apartment?.address ?? null;
  const apartmentName = unit?.apartment?.name ?? null;
  return {
    ...unit,
    address,
    apartment_name: apartmentName,
    apartment: undefined,
  };
}

/**
 * GET /api/apartments
 * Get all apartments (optionally filtered by apartmentowner_id or manager_id)
 */
export async function getApartments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("units")
      .select("*, apartment:apartment_id(address,name)")
      .order("created_at", { ascending: false });

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
    }
    if (req.query.manager_id) {
      query = query.eq("manager_id", req.query.manager_id as string);
    }

    const { data, error } = await query;

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, (data || []).map(withFlatAddress));
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
      .from("units")
      .select("*, apartment:apartment_id(address,name)")
      .eq("id", id)
      .single();

    if (error) {
      sendError(res, error.message, 404);
      return;
    }

    sendSuccess(res, withFlatAddress(data));
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
    const { address, ...rawPayload } = req.body || {};
    const payload = { ...rawPayload } as any;

    if (!payload.apartment_id && payload.apartmentowner_id) {
      payload.apartment_id = await getOrCreateApartmentForClient(
        payload.apartmentowner_id,
        payload.name,
        address
      );
    }

    const { data, error } = await supabaseAdmin
      .from("units")
      .insert(payload)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    if (address && payload.apartmentowner_id) {
      await supabaseAdmin
        .from("apartments")
        .update({ address, updated_at: new Date().toISOString() })
        .eq("apartmentowner_id", payload.apartmentowner_id);
    }

    sendSuccess(res, data, "Apartment created successfully", 201);

    if (data && payload.apartmentowner_id) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: payload.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "unit_created",
        entity_type: "unit",
        entity_id: data.id,
        description: `Created unit ${data.name || "New Unit"}`,
        metadata: { name: data.name, monthly_rent: data.monthly_rent },
      });
    }
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

    const preparedRows: any[] = [];
    for (const row of apartments || []) {
      const { address, ...rawPayload } = row || {};
      const payload = { ...rawPayload } as any;

      if (!payload.apartment_id && payload.apartmentowner_id) {
        payload.apartment_id = await getOrCreateApartmentForClient(
          payload.apartmentowner_id,
          payload.name,
          address
        );
      }

      if (address && payload.apartmentowner_id) {
        await supabaseAdmin
          .from("apartments")
          .update({ address, updated_at: new Date().toISOString() })
          .eq("apartmentowner_id", payload.apartmentowner_id);
      }

      preparedRows.push(payload);
    }

    const { data, error } = await supabaseAdmin
      .from("units")
      .insert(preparedRows)
      .select();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, `${data.length} apartments created successfully`, 201);

    const ownerIdForLog = preparedRows[0]?.apartmentowner_id;
    if (data && ownerIdForLog) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: ownerIdForLog,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "units_bulk_created",
        entity_type: "unit",
        entity_id: data[0]?.id || null,
        description: `Created ${data.length} units in bulk`,
        metadata: { count: data.length, names: data.map((u: any) => u.name) },
      });
    }
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
    const { address, ...rawUpdates } = req.body || {};
    const updates = { ...rawUpdates } as any;

    // Fetch old record for diff
    const { data: oldRecord } = await supabaseAdmin
      .from("units")
      .select("*")
      .eq("id", id)
      .single();

    if (!updates.apartment_id && updates.apartmentowner_id) {
      updates.apartment_id = await getOrCreateApartmentForClient(
        updates.apartmentowner_id,
        updates.name,
        address
      );
    }

    const { data, error } = await supabaseAdmin
      .from("units")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    const apartmentownerIdForAddress = updates.apartmentowner_id || data?.apartmentowner_id;
    if (address && apartmentownerIdForAddress) {
      await supabaseAdmin
        .from("apartments")
        .update({ address, updated_at: new Date().toISOString() })
        .eq("apartmentowner_id", apartmentownerIdForAddress);
    }

    sendSuccess(res, data, "Apartment updated successfully");

    if (oldRecord && data) {
      const changes: Record<string, { from: string; to: string }> = {};
      for (const key of Object.keys(rawUpdates)) {
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
          apartment_id: data.apartment_id || null,
          actor_id: req.user?.id || null,
          actor_name: actorName,
          actor_role: (req.user?.role as "owner" | "manager") || "owner",
          action: "unit_updated",
          entity_type: "unit",
          entity_id: id,
          description: `Updated unit ${data.name || id}`,
          metadata: { changes },
        });
      }
    }
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

    // Fetch unit before deletion for logging
    const { data: unit } = await supabaseAdmin
      .from("units")
      .select("name, apartmentowner_id")
      .eq("id", id)
      .single();

    // Soft-deactivate associated tenants first (preserve history)
    await supabaseAdmin
      .from("tenants")
      .update({
        status: "inactive",
        unit_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("unit_id", id);

    const { error } = await supabaseAdmin
      .from("units")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Apartment deleted successfully");

    if (unit) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: unit.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "unit_deleted",
        entity_type: "unit",
        entity_id: id,
        description: `Deleted unit ${unit.name}`,
      });
    }
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
      .from("units")
      .select("*, apartment:apartment_id(address,name)")
      .order("name", { ascending: true });

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
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
      .select("id, name, phone, unit_id")
      .eq("status", "active")
      .in("unit_id", aptIds);

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
      if (t.unit_id) {
        tenantMap[t.unit_id] = {
          id: t.id,
          name: t.name,
          phone: t.phone,
        };
      }
    });

    const results = (apartments || []).map((apt: any) => ({
      id: apt.id,
      name: apt.name,
      address: apt.apartment?.address ?? null,
      monthly_rent: Number(apt.monthly_rent) || 0,
      total_units: apt.total_units,
      apartmentowner_id: apt.apartmentowner_id,
      manager_id: apt.manager_id,
      status: apt.status,
      payment_due_day: apt.payment_due_day,
      max_occupancy: apt.max_occupancy ?? null,
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
    const { day, apartmentowner_id } = req.body;

    if (apartmentowner_id) {
      // Update all apartments for the given client
      const { error } = await supabaseAdmin
        .from("units")
        .update({ payment_due_day: day })
        .eq("apartmentowner_id", apartmentowner_id);

      if (error) {
        sendError(res, error.message, 500);
        return;
      }

      sendSuccess(res, null, "Payment due day updated for all apartments");

      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "payment_due_day_updated",
        entity_type: "unit",
        entity_id: null,
        description: `Set payment due day to ${day} for all units`,
        metadata: { day },
      });
    } else {
      const { id } = req.params;
      const { data, error } = await supabaseAdmin
        .from("units")
        .update({ payment_due_day: day })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        sendError(res, error.message, 500);
        return;
      }

      sendSuccess(res, data, "Payment due day updated");

      if (data?.apartmentowner_id) {
        const actorName = req.user?.id
          ? await resolveActorName(req.user.id, req.user.role, req.user.email)
          : "System";
        logActivity({
          apartmentowner_id: data.apartmentowner_id,
          actor_id: req.user?.id || null,
          actor_name: actorName,
          actor_role: (req.user?.role as "owner" | "manager") || "owner",
          action: "payment_due_day_updated",
          entity_type: "unit",
          entity_id: id,
          description: `Set payment due day to ${day} for unit ${data.name || id}`,
          metadata: { day, unit_name: data.name },
        });
      }
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/apartments/count
 * Get apartment count (optionally filtered by apartmentowner_id)
 */
export async function getApartmentCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("units")
      .select("*", { count: "exact", head: true });

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
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
