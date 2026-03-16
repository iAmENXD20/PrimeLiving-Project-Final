import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import {
  hasDeliverableEmailDomain,
  isValidEmailFormat,
  mailboxExists,
} from "../utils/emailValidation";

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

/**
 * GET /api/auth/validate-email?email=...
 * Validate email format, deliverability, mailbox existence, and uniqueness.
 */
export async function validateEmailForAccountCreation(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const normalizedEmail = String(req.query.email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      sendSuccess(res, {
        valid: false,
        reason: "Email is required",
      });
      return;
    }

    if (!isValidEmailFormat(normalizedEmail)) {
      sendSuccess(res, {
        valid: false,
        reason: "Please enter a valid email address",
      });
      return;
    }

    const deliverableDomain = await hasDeliverableEmailDomain(normalizedEmail);
    if (!deliverableDomain) {
      sendSuccess(res, {
        valid: false,
        reason: "Email domain does not exist or cannot receive mail",
      });
      return;
    }

    const existingMailbox = await mailboxExists(normalizedEmail);
    if (!existingMailbox) {
      sendSuccess(res, {
        valid: false,
        reason: "Email address could not be verified as an existing mailbox",
      });
      return;
    }

    const [existingClientLookup, existingManagerLookup, existingTenantLookup] =
      await Promise.all([
        supabaseAdmin
          .from("clients")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle(),
        supabaseAdmin
          .from("managers")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle(),
        supabaseAdmin
          .from("tenants")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle(),
      ]);

    if (
      existingClientLookup.error ||
      existingManagerLookup.error ||
      existingTenantLookup.error
    ) {
      sendError(
        res,
        existingClientLookup.error?.message ||
          existingManagerLookup.error?.message ||
          existingTenantLookup.error?.message ||
          "Failed to validate email",
        500
      );
      return;
    }

    if (
      existingClientLookup.data ||
      existingManagerLookup.data ||
      existingTenantLookup.data
    ) {
      sendSuccess(res, {
        valid: false,
        reason: "Email is already used by another account",
      });
      return;
    }

    sendSuccess(res, { valid: true });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
