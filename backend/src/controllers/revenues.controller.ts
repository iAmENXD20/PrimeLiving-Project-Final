import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

/**
 * GET /api/revenues
 * Get revenues filtered by client_id, with optional apartment name join
 */
export async function getRevenues(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("revenues")
      .select("*, apartments:unit_id(name)")
      .order("month", { ascending: false });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
    }

    const { data, error } = await query;

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    // Flatten apartment name into each record
    const results = (data || []).map((r: any) => ({
      ...r,
      apartment_name: r.apartments?.name || null,
      apartments: undefined,
    }));

    sendSuccess(res, results);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/revenues/by-month
 * Get revenue aggregated by month for a client
 */
export async function getRevenueByMonth(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const clientId = req.query.client_id as string;

    if (!clientId) {
      sendError(res, "client_id query parameter is required", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("revenues")
      .select("amount, month")
      .eq("client_id", clientId)
      .order("month", { ascending: true });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    // Aggregate by month (YYYY-MM)
    const monthMap: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      const key = r.month.slice(0, 7);
      monthMap[key] = (monthMap[key] || 0) + Number(r.amount);
    });

    const results = Object.entries(monthMap).map(([month, total]) => ({
      month,
      revenue: total,
    }));

    sendSuccess(res, results);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/revenues
 * Create a revenue record
 */
export async function createRevenue(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("revenues")
      .insert(req.body)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Revenue created successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
