import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

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
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      sendError(res, "Email is required", 400);
      return;
    }

    const { data: existingClient, error: existingClientError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingClientError) {
      sendError(res, existingClientError.message, 500);
      return;
    }

    if (existingClient) {
      sendError(res, "Owner account with this email already exists", 409);
      return;
    }

    const requestOrigin = req.headers.origin;
    const redirectTo =
      requestOrigin && /^https?:\/\//i.test(requestOrigin)
        ? requestOrigin
        : env.FRONTEND_URL;

    // Invite owner via email verification flow
    const { data: inviteData, error: authError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo,
        data: {
          role: "owner",
          name,
          login_email: normalizedEmail,
          app_name: "PrimeLiving",
        },
      });

    if (authError) {
      sendError(res, authError.message);
      return;
    }

    if (!inviteData.user?.id) {
      sendError(res, "Failed to create owner auth account", 500);
      return;
    }

    // Create client record linked to auth user
    const { data, error } = await supabaseAdmin
      .from("clients")
      .insert({
        auth_user_id: inviteData.user.id,
        name,
        email: normalizedEmail,
        phone,
        apartment_address,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      // Cleanup: delete the auth user if client record fails
      await supabaseAdmin.auth.admin.deleteUser(inviteData.user.id);
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(
      res,
      { ...data, requiresEmailVerification: true },
      "Client created successfully. Verification email sent.",
      201
    );
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
