import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, getManagerScope } from "../utils/helpers";

/**
 * GET /api/repairmen
 * List repairmen scoped to an owner (or via manager's owner)
 */
export async function getRepairmen(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let ownerId = req.query.apartmentowner_id as string | undefined;

    // If manager, resolve their owner
    if (!ownerId && req.query.manager_id) {
      const { data: mgr } = await supabaseAdmin
        .from("apartment_managers")
        .select("apartmentowner_id")
        .eq("id", req.query.manager_id as string)
        .maybeSingle();
      ownerId = mgr?.apartmentowner_id;
    }

    if (!ownerId) {
      sendError(res, "apartmentowner_id or manager_id is required", 400);
      return;
    }

    const activeOnly = req.query.active_only === "true";

    let query = supabaseAdmin
      .from("repairmen")
      .select("*")
      .eq("apartmentowner_id", ownerId)
      .order("name", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    // Enrich with average ratings from completed maintenance reviews
    if (data && data.length > 0) {
      const ids = data.map((r: any) => r.id);
      const { data: ratingsData } = await supabaseAdmin
        .from("maintenance")
        .select("assigned_repairman_id, review_rating")
        .in("assigned_repairman_id", ids)
        .eq("status", "closed")
        .not("review_rating", "is", null);

      const ratingMap: Record<string, { sum: number; count: number }> = {};
      for (const row of ratingsData || []) {
        if (!row.assigned_repairman_id || !row.review_rating) continue;
        if (!ratingMap[row.assigned_repairman_id]) ratingMap[row.assigned_repairman_id] = { sum: 0, count: 0 };
        ratingMap[row.assigned_repairman_id].sum += row.review_rating;
        ratingMap[row.assigned_repairman_id].count++;
      }

      const enriched = data.map((r: any) => ({
        ...r,
        avg_rating: ratingMap[r.id] ? Math.round((ratingMap[r.id].sum / ratingMap[r.id].count) * 10) / 10 : null,
        total_reviews: ratingMap[r.id]?.count ?? 0,
      }));

      sendSuccess(res, enriched);
      return;
    }

    sendSuccess(res, data);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/repairmen
 * Create a repairman
 */
export async function createRepairman(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { apartmentowner_id, name, phone, specialty, notes } = req.body;

    if (!apartmentowner_id || !name?.trim()) {
      sendError(res, "apartmentowner_id and name are required", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("repairmen")
      .insert({
        apartmentowner_id,
        name: name.trim(),
        phone: phone?.trim() || null,
        specialty: specialty?.trim() || null,
        notes: notes?.trim() || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Repairman added successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/repairmen/:id
 * Update a repairman
 */
export async function updateRepairman(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, phone, specialty, notes, is_active } = req.body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (specialty !== undefined) updates.specialty = specialty?.trim() || null;
    if (notes !== undefined) updates.notes = notes?.trim() || null;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      sendError(res, "No fields to update", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("repairmen")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Repairman updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/repairmen/:id
 * Soft-delete (deactivate) a repairman
 */
export async function deleteRepairman(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("repairmen")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Repairman deactivated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
