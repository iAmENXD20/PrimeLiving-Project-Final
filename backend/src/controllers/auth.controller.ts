import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { withAdminRetry } from "../utils/adminRetry";
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
      // Check if this email belongs to a pending_verification account
      // so we can show a proper "under review" message instead of generic credentials error
      if (error.message === "Invalid login credentials") {
        const { data: manager } = await supabaseAdmin
          .from("apartment_managers")
          .select("status")
          .eq("email", email)
          .in("status", ["pending_verification", "pending"])
          .maybeSingle();

        if (manager) {
          const msg = manager.status === "pending_verification"
            ? "Your account is currently under review. Please wait for your apartment owner to approve your account before you can log in."
            : "Please complete your account setup by accepting the invitation sent to your email.";
          sendError(res, msg, 403);
          return;
        }

        const { data: tenant } = await supabaseAdmin
          .from("tenants")
          .select("status")
          .eq("email", email)
          .in("status", ["pending_verification", "pending"])
          .maybeSingle();

        if (tenant) {
          const msg = tenant.status === "pending_verification"
            ? "Your account is currently under review. Please wait for your apartment manager to approve your account before you can log in."
            : "Please complete your account setup by accepting the invitation sent to your email.";
          sendError(res, msg, 403);
          return;
        }
      }

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

    const [existingOwnerLookup, existingManagerLookup, existingTenantLookup] =
      await Promise.all([
        supabaseAdmin
          .from("apartment_owners")
          .select("id")
          .eq("email", normalizedEmail)
          .maybeSingle(),
        supabaseAdmin
          .from("apartment_managers")
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
      existingOwnerLookup.error ||
      existingManagerLookup.error ||
      existingTenantLookup.error
    ) {
      sendError(
        res,
        existingOwnerLookup.error?.message ||
          existingManagerLookup.error?.message ||
          existingTenantLookup.error?.message ||
          "Failed to validate email",
        500
      );
      return;
    }

    if (
      existingOwnerLookup.data ||
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

/**
 * GET /api/auth/check-setup
 * Check if the system has been set up (at least one owner exists)
 */
export async function checkSetup(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { count, error } = await withAdminRetry((client) =>
      client
        .from("apartment_owners")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
    );

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, { isSetup: (count ?? 0) > 0 });
  } catch (err: any) {
    console.error("[checkSetup] caught:", err);
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/auth/setup
 * First-time owner/admin account creation.
 * Only works when no active owner exists in the system.
 */
export async function setupOwner(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    // Block if an owner already exists
    const { count, error: countError } = await withAdminRetry((client) =>
      client
        .from("apartment_owners")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
    );

    if (countError) {
      sendError(res, countError.message, 500);
      return;
    }

    if ((count ?? 0) > 0) {
      sendError(res, "System is already set up. Owner account exists.", 403);
      return;
    }

    const { first_name, last_name, email, phone, password, sex, birthdate } = req.body;

    if (!first_name || !email || !password) {
      sendError(res, "First name, email, and password are required", 400);
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    if (!isValidEmailFormat(normalizedEmail)) {
      sendError(res, "Please enter a valid email address", 400);
      return;
    }

    if (String(password).length < 8) {
      sendError(res, "Password must be at least 8 characters", 400);
      return;
    }

    // Create Supabase auth user directly (no email verification needed for owner/admin)
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          role: "owner",
          name: `${first_name} ${last_name || ""}`.trim(),
        },
        app_metadata: {
          role: "owner",
        },
      });

    if (authError || !authData.user) {
      sendError(res, authError?.message || "Failed to create auth account", 500);
      return;
    }

    // Create apartment_owners record
    const { data: ownerData, error: ownerError } = await supabaseAdmin
      .from("apartment_owners")
      .insert({
        auth_user_id: authData.user.id,
        first_name: first_name.trim(),
        last_name: (last_name || "").trim(),
        email: normalizedEmail,
        phone: phone || null,
        sex: sex || null,
        birthdate: birthdate || null,
        status: "active",
      })
      .select()
      .single();

    if (ownerError) {
      // Cleanup: delete auth user if DB insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      sendError(res, ownerError.message, 500);
      return;
    }

    sendSuccess(
      res,
      { owner: ownerData },
      "Owner account created successfully. You can now log in.",
      201
    );
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
