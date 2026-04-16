import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { sendSuccess, sendError } from "../utils/helpers";
import { AuthenticatedRequest } from "../types/express";

export async function getExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { apartmentowner_id, year } = req.query;
    if (!apartmentowner_id) {
      sendError(res, "apartmentowner_id is required", 400);
      return;
    }

    let query = supabaseAdmin
      .from("expenses")
      .select("*")
      .eq("apartmentowner_id", apartmentowner_id as string)
      .order("date", { ascending: false });

    if (year) {
      query = query
        .gte("date", `${year}-01-01`)
        .lte("date", `${year}-12-31`);
    }

    const { data, error } = await query;
    if (error) { sendError(res, error.message, 500); return; }
    sendSuccess(res, data || []);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

export async function createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { apartmentowner_id, apartment_id, date, type, description, amount } = req.body;
    if (!apartmentowner_id || !date || !type || amount == null) {
      sendError(res, "apartmentowner_id, date, type, and amount are required", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("expenses")
      .insert({ apartmentowner_id, apartment_id: apartment_id || null, date, type, description: description || null, amount })
      .select()
      .single();

    if (error) { sendError(res, error.message, 500); return; }
    sendSuccess(res, data, 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

export async function deleteExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("expenses").delete().eq("id", id);
    if (error) { sendError(res, error.message, 500); return; }
    sendSuccess(res, { deleted: true });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
