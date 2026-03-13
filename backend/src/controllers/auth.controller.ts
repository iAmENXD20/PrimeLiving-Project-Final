import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

/**
 * POST /api/auth/login
 * Sign in with email and password
 */
export async function login(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      sendError(res, error.message, 401);
      return;
    }

    sendSuccess(res, {
      user: data.user,
      session: data.session,
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/auth/logout
 * Sign out (invalidate session server-side is not natively supported,
 * but we can sign out the admin client's awareness of the session)
 */
export async function logout(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    sendSuccess(res, null, "Logged out successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/auth/reset-password
 * Send a password reset email
 */
export async function resetPassword(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { email } = req.body;

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email);

    if (error) {
      sendError(res, error.message);
      return;
    }

    sendSuccess(res, null, "Password reset email sent");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/auth/update-password
 * Change the authenticated user's password
 */
export async function updatePassword(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { password } = req.body;

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      req.user!.id,
      { password }
    );

    if (error) {
      sendError(res, error.message);
      return;
    }

    sendSuccess(res, null, "Password updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/auth/me
 * Get the current authenticated user's info
 */
export async function getMe(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    sendSuccess(res, { user: req.user });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
