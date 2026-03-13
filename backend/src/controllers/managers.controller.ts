import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, generateRandomPassword } from "../utils/helpers";

/**
 * GET /api/managers
 * Get all managers (optionally filtered by client_id)
 */
export async function getManagers(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("managers")
      .select("*")
      .order("created_at", { ascending: false });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
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
 * GET /api/managers/:id
 * Get a single manager by ID
 */
export async function getManagerById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("managers")
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
 * GET /api/managers/by-auth/:authUserId
 * Get a manager by auth_user_id
 */
export async function getManagerByAuthId(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { authUserId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("managers")
      .select("*")
      .eq("auth_user_id", authUserId)
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
 * POST /api/managers
 * Create a new manager (also creates Supabase Auth account)
 */
export async function createManager(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { name, email, phone, client_id } = req.body;

    const password = generateRandomPassword();
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: "manager", name },
      });

    if (authError) {
      sendError(res, authError.message);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("managers")
      .insert({
        auth_user_id: authData.user.id,
        name,
        email,
        phone,
        client_id,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(
      res,
      {
        ...data,
        generatedPassword: password,
        generated_password: password,
        password,
      },
      "Manager created successfully",
      201
    );
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/managers/:id
 * Update a manager
 */
export async function updateManager(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabaseAdmin
      .from("managers")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Manager updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/managers/:id
 * Delete a manager
 */
export async function deleteManager(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("managers")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Manager deleted successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/managers/count
 * Get total manager count
 */
export async function getManagerCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { count, error } = await supabaseAdmin
      .from("managers")
      .select("*", { count: "exact", head: true });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, { count });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
