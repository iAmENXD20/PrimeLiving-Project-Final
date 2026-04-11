import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, getManagerScope } from "../utils/helpers";

/**
 * GET /api/apartment-logs
 * Get logs filtered by apartmentowner_id, with optional filters
 */
export async function getApartmentLogs(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("apartment_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (req.query.apartmentowner_id) {
      query = query.eq(
        "apartmentowner_id",
        req.query.apartmentowner_id as string
      );
    }

    if (req.query.manager_id) {
      const { apartmentIds } = await getManagerScope(req.query.manager_id as string);
      if (apartmentIds.length === 0) {
        sendSuccess(res, []);
        return;
      }
      query = query.in("apartment_id", apartmentIds);
    }

    if (req.query.apartment_id) {
      query = query.eq("apartment_id", req.query.apartment_id as string);
    }

    if (req.query.action) {
      query = query.eq("action", req.query.action as string);
    }

    if (req.query.entity_type) {
      query = query.eq("entity_type", req.query.entity_type as string);
    }

    if (req.query.actor_role) {
      query = query.eq("actor_role", req.query.actor_role as string);
    }

    // Date range filtering
    if (req.query.from) {
      query = query.gte("created_at", req.query.from as string);
    }
    if (req.query.to) {
      query = query.lte("created_at", req.query.to as string);
    }

    // Pagination
    const limit = Math.min(
      parseInt(req.query.limit as string) || 50,
      200
    );
    const offset = parseInt(req.query.offset as string) || 0;
    query = query.range(offset, offset + limit - 1);

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
 * POST /api/apartment-logs
 * Create a new log entry
 */
export async function createApartmentLog(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const {
      apartmentowner_id,
      apartment_id,
      actor_name,
      actor_role,
      action,
      entity_type,
      entity_id,
      description,
      metadata,
    } = req.body;

    if (!apartmentowner_id || !action || !description || !actor_name) {
      sendError(
        res,
        "apartmentowner_id, actor_name, action, and description are required",
        400
      );
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("apartment_logs")
      .insert({
        apartmentowner_id,
        apartment_id: apartment_id || null,
        actor_id: req.user?.id || null,
        actor_name,
        actor_role: actor_role || req.user?.role || null,
        action,
        entity_type: entity_type || null,
        entity_id: entity_id || null,
        description,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Log entry created successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/apartment-logs/:id
 * Delete a single log entry
 */
export async function deleteApartmentLog(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("apartment_logs")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Log entry deleted successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/apartment-logs
 * Clear all logs for an apartment owner (bulk delete)
 */
export async function clearApartmentLogs(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const apartmentowner_id =
      req.query.apartmentowner_id as string | undefined;

    if (!apartmentowner_id) {
      sendError(res, "apartmentowner_id query parameter is required", 400);
      return;
    }

    const { error } = await supabaseAdmin
      .from("apartment_logs")
      .delete()
      .eq("apartmentowner_id", apartmentowner_id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "All logs cleared successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
