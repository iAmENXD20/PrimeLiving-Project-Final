import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

/**
 * GET /api/maintenance
 * Get maintenance requests (filtered by client_id or tenant_id)
 */
export async function getMaintenanceRequests(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("maintenance_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
    }
    if (req.query.tenant_id) {
      query = query.eq("tenant_id", req.query.tenant_id as string);
    }
    if (req.query.status) {
      query = query.eq("status", req.query.status as string);
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
 * GET /api/maintenance/:id
 * Get a single maintenance request
 */
export async function getMaintenanceRequestById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("maintenance_requests")
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
 * POST /api/maintenance
 * Create a new maintenance request (tenant submits)
 */
export async function createMaintenanceRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { tenant_id, apartment_id, client_id, title, description, priority, photo_url } =
      req.body;

    const { data, error } = await supabaseAdmin
      .from("maintenance_requests")
      .insert({
        tenant_id,
        apartment_id,
        client_id,
        title,
        description,
        priority,
        status: "pending",
        photo_url: photo_url || null,
      })
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Maintenance request created successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/maintenance/:id/status
 * Update maintenance request status
 */
export async function updateMaintenanceStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabaseAdmin
      .from("maintenance_requests")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Maintenance status updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/maintenance/count/pending
 * Get count of pending maintenance requests (filtered by client_id)
 */
export async function getPendingMaintenanceCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("maintenance_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

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
