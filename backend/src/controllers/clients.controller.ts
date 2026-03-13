import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, generateRandomPassword } from "../utils/helpers";

/**
 * GET /api/clients
 * Get all clients
 */
export async function getClients(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

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
 * GET /api/clients/:id
 * Get a single client by ID
 */
export async function getClientById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("clients")
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
 * GET /api/clients/by-auth/:authUserId
 * Get a client by their auth_user_id
 */
export async function getClientByAuthId(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { authUserId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("clients")
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
 * POST /api/clients
 * Create a new client (also creates a Supabase Auth account)
 */
export async function createClient(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { name, email, phone, apartment_address } = req.body;

    // Create auth user with random password
    const password = generateRandomPassword();
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: "owner", name },
      });

    if (authError) {
      sendError(res, authError.message);
      return;
    }

    // Create client record linked to auth user
    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert({
        auth_user_id: authData.user.id,
        name,
        email,
        phone,
        apartment_address,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      // Cleanup: delete the auth user if client record fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, { ...data, generatedPassword: password }, "Client created successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/clients/:id
 * Update a client
 */
export async function updateClient(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabaseAdmin
      .from("clients")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Client updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/clients/:id
 * Delete a client
 */
export async function deleteClient(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("clients")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Client deleted successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/clients/count
 * Get total client count
 */
export async function getClientCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { count, error } = await supabaseAdmin
      .from("clients")
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
