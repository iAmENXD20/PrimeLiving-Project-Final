import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { logActivity, resolveActorName } from "../utils/activityLog";

/**
 * GET /api/revenues
 * Get revenues filtered by apartmentowner_id, with optional apartment name join
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

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
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
 * Get revenue aggregated by month for an owner
 */
export async function getRevenueByMonth(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const apartmentownerId = req.query.apartmentowner_id as string;

    if (!apartmentownerId) {
      sendError(res, "apartmentowner_id query parameter is required", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("revenues")
      .select("amount, month")
      .eq("apartmentowner_id", apartmentownerId)
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

    if (data && req.body.apartmentowner_id) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: req.body.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "revenue_created",
        entity_type: "revenue",
        entity_id: data.id,
        description: `Created revenue record — Amount: ${data.amount || 0}`,
        metadata: { amount: data.amount, month: data.month, description: data.description },
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
