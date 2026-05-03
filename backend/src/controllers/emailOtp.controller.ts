import { Response } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { sendEmail } from "../utils/email";

function generateCode(): string {
  // 6-digit numeric OTP
  return String(Math.floor(100000 + crypto.randomInt(900000))).padStart(6, "0");
}

function emailOtpHtml(code: string): string {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <div style="background:#1e3a5f;padding:24px 32px;border-radius:8px 8px 0 0;">
        <h2 style="color:#fff;margin:0;font-size:20px;">EAMS — Email Verification Code</h2>
      </div>
      <div style="background:#f4f7fb;padding:32px;border-radius:0 0 8px 8px;border:1px solid #dde3ee;">
        <p style="color:#374151;font-size:16px;margin-top:0;">
          Use the code below to complete your sign-in. This code expires in <strong>10 minutes</strong>.
        </p>
        <div style="background:#fff;border:2px solid #1e3a5f;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
          <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#1e3a5f;">${code}</span>
        </div>
        <p style="color:#6b7280;font-size:13px;margin-bottom:0;">
          If you did not attempt to sign in, please change your password immediately.
        </p>
      </div>
    </div>
  `;
}

/**
 * POST /api/auth/mfa/email-otp/send
 * Generate and send an email OTP to the authenticated user's email
 */
export async function sendEmailOtp(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const email = req.user!.email;

    if (!email) {
      sendError(res, "No email associated with this account", 400);
      return;
    }

    // Invalidate any existing unused codes for this user
    await supabaseAdmin
      .from("email_otp_challenges")
      .update({ used: true })
      .eq("user_id", userId)
      .eq("used", false);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    const { error } = await supabaseAdmin.from("email_otp_challenges").insert({
      user_id: userId,
      code,
      expires_at: expiresAt,
    });

    if (error) {
      sendError(res, "Failed to generate OTP", 500);
      return;
    }

    // Send email (non-blocking)
    sendEmail({
      to: email,
      subject: "Your EAMS Sign-In Code",
      html: emailOtpHtml(code),
    }).catch((err) => console.error("Failed to send OTP email:", err));

    // Mask email for response
    const [localPart, domain] = email.split("@");
    const maskedEmail = `${localPart.slice(0, 2)}***@${domain}`;

    sendSuccess(res, { maskedEmail }, "OTP sent successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/auth/mfa/email-otp/verify
 * Verify the submitted email OTP code
 */
export async function verifyEmailOtp(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { code } = req.body;

    if (!code || typeof code !== "string" || code.length !== 6) {
      sendError(res, "Invalid code format", 400);
      return;
    }

    // Find the latest unused, unexpired code for this user
    const { data: challenge, error } = await supabaseAdmin
      .from("email_otp_challenges")
      .select("id, code, expires_at, used")
      .eq("user_id", userId)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !challenge) {
      sendError(res, "Code expired or not found. Please request a new code.", 400);
      return;
    }

    // Constant-time comparison to prevent timing attacks
    const expected = Buffer.from(challenge.code);
    const provided = Buffer.from(code);
    const match =
      expected.length === provided.length &&
      crypto.timingSafeEqual(expected, provided);

    if (!match) {
      sendError(res, "Invalid code. Please check and try again.", 401);
      return;
    }

    // Mark as used
    await supabaseAdmin
      .from("email_otp_challenges")
      .update({ used: true })
      .eq("id", challenge.id);

    sendSuccess(res, { verified: true }, "Email OTP verified");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/auth/mfa/preference
 * Get the user's MFA method preference
 */
export async function getMfaPreference(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;

    const { data } = await supabaseAdmin
      .from("user_mfa_preferences")
      .select("mfa_method")
      .eq("user_id", userId)
      .maybeSingle();

    sendSuccess(res, { mfa_method: data?.mfa_method || null });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/auth/mfa/preference
 * Set the user's MFA method preference
 */
export async function setMfaPreference(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { mfa_method } = req.body;

    if (!["email", "totp"].includes(mfa_method)) {
      sendError(res, "Invalid MFA method. Must be 'email' or 'totp'.", 400);
      return;
    }

    const { error } = await supabaseAdmin
      .from("user_mfa_preferences")
      .upsert({ user_id: userId, mfa_method, updated_at: new Date().toISOString() });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, { mfa_method }, "MFA preference updated");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/auth/mfa/preference
 * Remove the user's email OTP MFA preference (disable email OTP)
 */
export async function removeMfaPreference(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.id;

    await supabaseAdmin
      .from("user_mfa_preferences")
      .delete()
      .eq("user_id", userId)
      .eq("mfa_method", "email");

    sendSuccess(res, null, "Email OTP disabled");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
