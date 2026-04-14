import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, getManagerScope } from "../utils/helpers";
import { logActivity, resolveActorName } from "../utils/activityLog";

async function getOrCreateApartmentForOwner(
  apartmentownerId: string,
  nameHint?: string | null
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
  const apartmentName = unit?.apartment?.name ?? null;
  return {
    ...unit,
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
      .select("*, apartment:apartment_id(name)")
      .order("created_at", { ascending: false });

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
    }
    if (req.query.manager_id) {
      const { unitIds } = await getManagerScope(req.query.manager_id as string);
      if (unitIds.length === 0) {
        sendSuccess(res, []);
        return;
      }
      query = query.in("id", unitIds);
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
      .select("*, apartment:apartment_id(name)")
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
    const payload = { ...(req.body || {}) } as any;

    if (!payload.apartment_id && payload.apartmentowner_id) {
      payload.apartment_id = await getOrCreateApartmentForOwner(
        payload.apartmentowner_id,
        payload.name
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
      const payload = { ...(row || {}) } as any;

      if (!payload.apartment_id && payload.apartmentowner_id) {
        payload.apartment_id = await getOrCreateApartmentForOwner(
          payload.apartmentowner_id,
          payload.name
        );
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
    const updates = { ...(req.body || {}) } as any;

    // Fetch old record for diff
    const { data: oldRecord } = await supabaseAdmin
      .from("units")
      .select("*")
      .eq("id", id)
      .single();

    if (!updates.apartment_id && updates.apartmentowner_id) {
      updates.apartment_id = await getOrCreateApartmentForOwner(
        updates.apartmentowner_id,
        updates.name
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

    sendSuccess(res, data, "Apartment updated successfully");

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
      const { unitIds } = await getManagerScope(req.query.manager_id as string);
      if (unitIds.length === 0) {
        sendSuccess(res, []);
        return;
      }
      query = query.in("id", unitIds);
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
      .select("id, first_name, last_name, phone, unit_id")
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
          name: `${t.first_name} ${t.last_name}`.trim(),
          phone: t.phone,
        };
      }
    });

    const results = (apartments || []).map((apt: any) => ({
      id: apt.id,
      name: apt.name,
      address: apt.apartment?.address ?? null,
      monthly_rent: Number(apt.monthly_rent) || 0,
      contract_duration: apt.contract_duration ?? null,
      lease_start: apt.lease_start ?? null,
      lease_end: apt.lease_end ?? null,
      total_units: apt.total_units,
      apartmentowner_id: apt.apartmentowner_id,
      apartment_id: apt.apartment_id || null,
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
 * Set payment_due_day for an apartment (or all apartments under an owner)
 */
export async function setPaymentDueDay(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { day, apartmentowner_id, manager_id } = req.body;

    if (manager_id) {
      // Update only units in the manager's assigned apartments
      const { unitIds } = await getManagerScope(manager_id);
      if (unitIds.length === 0) {
        sendSuccess(res, null, "No units found for this manager");
        return;
      }

      const { error } = await supabaseAdmin
        .from("units")
        .update({ payment_due_day: day })
        .in("id", unitIds);

      if (error) {
        sendError(res, error.message, 500);
        return;
      }

      sendSuccess(res, null, "Payment due day updated for managed apartments");

      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: apartmentowner_id || null,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: "manager",
        action: "payment_due_day_updated",
        entity_type: "unit",
        entity_id: null,
        description: `Set payment due day to ${day} for managed units`,
        metadata: { day, manager_id },
      });
    } else if (apartmentowner_id) {
      // Update all apartments for the given owner
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
    if (req.query.manager_id) {
      const { unitIds } = await getManagerScope(req.query.manager_id as string);
      if (unitIds.length === 0) {
        sendSuccess(res, { count: 0 });
        return;
      }
      query = query.in("id", unitIds);
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

// ════════════════════════════════════════════════════════════
// PROPERTY-LEVEL APARTMENTS (buildings/locations)
// ════════════════════════════════════════════════════════════

/**
 * GET /api/apartments/properties
 * List all property-level apartments for an owner, with unit counts
 */
export async function getProperties(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const apartmentownerId = req.query.apartmentowner_id as string;
    if (!apartmentownerId) {
      sendError(res, "apartmentowner_id is required", 400);
      return;
    }

    const { data: properties, error } = await supabaseAdmin
      .from("apartments")
      .select("*")
      .eq("apartmentowner_id", apartmentownerId)
      .order("created_at", { ascending: true });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    // Get unit counts and managers per property
    const propIds = (properties || []).map((p: any) => p.id);
    let unitCounts: Record<string, number> = {};
    let managersMap: Record<string, any[]> = {};

    if (propIds.length > 0) {
      const [unitResult, managerResult] = await Promise.all([
        supabaseAdmin
          .from("units")
          .select("apartment_id")
          .in("apartment_id", propIds),
        supabaseAdmin
          .from("apartment_managers")
          .select("id, first_name, last_name, email, phone, status, apartment_id")
          .in("apartment_id", propIds),
      ]);

      (unitResult.data || []).forEach((u: any) => {
        if (u.apartment_id) {
          unitCounts[u.apartment_id] = (unitCounts[u.apartment_id] || 0) + 1;
        }
      });

      (managerResult.data || []).forEach((m: any) => {
        if (m.apartment_id) {
          if (!managersMap[m.apartment_id]) managersMap[m.apartment_id] = [];
          managersMap[m.apartment_id].push(m);
        }
      });
    }

    const results = (properties || []).map((p: any) => ({
      ...p,
      unit_count: unitCounts[p.id] || 0,
      managers: managersMap[p.id] || [],
    }));

    sendSuccess(res, results);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/apartments/properties
 * Create a new property (building/location)
 */
export async function createProperty(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const {
      name, apartmentowner_id,
      address_region, address_region_code,
      address_province, address_province_code,
      address_city, address_city_code,
      address_district, address_district_code,
      address_area, address_area_code,
      address_barangay, address_barangay_code,
      address_street,
    } = req.body;

    if (!name || !apartmentowner_id) {
      sendError(res, "name and apartmentowner_id are required", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("apartments")
      .insert({
        apartmentowner_id,
        name,
        status: "active",
        address_region: address_region || null,
        address_region_code: address_region_code || null,
        address_province: address_province || null,
        address_province_code: address_province_code || null,
        address_city: address_city || null,
        address_city_code: address_city_code || null,
        address_district: address_district || null,
        address_district_code: address_district_code || null,
        address_area: address_area || null,
        address_area_code: address_area_code || null,
        address_barangay: address_barangay || null,
        address_barangay_code: address_barangay_code || null,
        address_street: address_street || null,
      })
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Property created successfully", 201);

    if (data) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id,
        apartment_id: data.id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "property_created",
        entity_type: "apartment",
        entity_id: data.id,
        description: `Created property "${name}"`,
        metadata: { name },
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/apartments/properties/:id
 * Update a property
 */
export async function updateProperty(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const {
      name, status,
      address_region, address_region_code,
      address_province, address_province_code,
      address_city, address_city_code,
      address_district, address_district_code,
      address_area, address_area_code,
      address_barangay, address_barangay_code,
      address_street,
    } = req.body;

    const updates: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    if (address_region !== undefined) updates.address_region = address_region;
    if (address_region_code !== undefined) updates.address_region_code = address_region_code;
    if (address_province !== undefined) updates.address_province = address_province;
    if (address_province_code !== undefined) updates.address_province_code = address_province_code;
    if (address_city !== undefined) updates.address_city = address_city;
    if (address_city_code !== undefined) updates.address_city_code = address_city_code;
    if (address_district !== undefined) updates.address_district = address_district;
    if (address_district_code !== undefined) updates.address_district_code = address_district_code;
    if (address_area !== undefined) updates.address_area = address_area;
    if (address_area_code !== undefined) updates.address_area_code = address_area_code;
    if (address_barangay !== undefined) updates.address_barangay = address_barangay;
    if (address_barangay_code !== undefined) updates.address_barangay_code = address_barangay_code;
    if (address_street !== undefined) updates.address_street = address_street;

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

    sendSuccess(res, data, "Property updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/apartments/properties/:id
 * Delete a property and deactivate its units/tenants
 */
export async function deleteProperty(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    // Fetch property name for logging
    const { data: prop } = await supabaseAdmin
      .from("apartments")
      .select("name, apartmentowner_id")
      .eq("id", id)
      .single();

    // Deactivate tenants in units of this property
    const { data: unitIds } = await supabaseAdmin
      .from("units")
      .select("id")
      .eq("apartment_id", id);

    if (unitIds && unitIds.length > 0) {
      await supabaseAdmin
        .from("tenants")
        .update({ status: "inactive", unit_id: null, updated_at: new Date().toISOString() })
        .in("unit_id", unitIds.map((u: any) => u.id));

      // Delete units
      await supabaseAdmin
        .from("units")
        .delete()
        .eq("apartment_id", id);
    }

    const { error } = await supabaseAdmin
      .from("apartments")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Property deleted successfully");

    if (prop) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: prop.apartmentowner_id,
        apartment_id: id as string,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "property_deleted",
        entity_type: "apartment",
        entity_id: id,
        description: `Deleted property "${prop.name}"`,
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
