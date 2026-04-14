import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

/**
 * GET /api/apartments/occupants/:unitId
 * Get all occupants for a unit
 */
export async function getOccupants(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { unitId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("unit_occupants")
      .select("*")
      .eq("unit_id", unitId)
      .order("created_at", { ascending: true });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data || []);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/apartments/occupants
 * Add an occupant to a unit
 */
export async function addOccupant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { unit_id, tenant_id, full_name, first_name, last_name, sex, phone, id_photo_url } = req.body;

    const resolvedFirstName = first_name || (full_name ? full_name.split(' ')[0] : '')
    const resolvedLastName = last_name || (full_name ? full_name.split(' ').slice(1).join(' ') : '')
    const resolvedFullName = full_name || `${resolvedFirstName} ${resolvedLastName}`.trim()

    if (!unit_id || !tenant_id || !resolvedFirstName?.trim()) {
      sendError(res, "unit_id, tenant_id, and first_name are required", 400);
      return;
    }

    // Check max_occupancy limit
    const { data: unit } = await supabaseAdmin
      .from("units")
      .select("max_occupancy")
      .eq("id", unit_id)
      .single();

    if (unit?.max_occupancy) {
      const { count } = await supabaseAdmin
        .from("unit_occupants")
        .select("*", { count: "exact", head: true })
        .eq("unit_id", unit_id);

      // +1 for the main tenant
      if ((count || 0) + 1 >= unit.max_occupancy) {
        sendError(
          res,
          `Maximum occupancy of ${unit.max_occupancy} reached (including main tenant)`,
          400
        );
        return;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("unit_occupants")
      .insert({
        unit_id,
        tenant_id,
        full_name: resolvedFullName,
        first_name: resolvedFirstName.trim(),
        last_name: resolvedLastName.trim(),
        sex: sex || null,
        phone: phone || null,
        id_photo_url: id_photo_url || null,
      })
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Occupant added successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/apartments/occupants/:id
 * Update an occupant
 */
export async function updateOccupant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { full_name, id_photo_url } = req.body;

    const updates: any = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (id_photo_url !== undefined) updates.id_photo_url = id_photo_url;

    const { data, error } = await supabaseAdmin
      .from("unit_occupants")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Occupant updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/apartments/occupants/:id
 * Remove an occupant
 */
export async function deleteOccupant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("unit_occupants")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Occupant removed successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
