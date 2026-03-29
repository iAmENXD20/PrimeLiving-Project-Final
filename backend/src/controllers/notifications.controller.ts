import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { sendSmsSemaphore } from "../utils/sms";
import { env } from "../config/env";

export async function getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const recipientRole = req.query.recipient_role as string | undefined;
    const recipientId = req.query.recipient_id as string | undefined;
    const apartmentownerId = req.query.apartmentowner_id as string | undefined;
    const apartmentId = req.query.apartment_id as string | undefined;

    let query = supabaseAdmin
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (recipientRole) query = query.eq("recipient_role", recipientRole);
    if (recipientId) query = query.eq("recipient_id", recipientId);
    if (apartmentownerId) query = query.eq("apartmentowner_id", apartmentownerId);
    if (apartmentId) query = query.eq("apartment_id", apartmentId);

    const { data, error } = await query;
    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data || []);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

export async function markNotificationRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Notification marked as read");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

export async function markAllNotificationsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const recipientRole = req.body.recipient_role as string | undefined;
    const recipientId = req.body.recipient_id as string | undefined;

    if (!recipientRole || !recipientId) {
      sendError(res, "recipient_role and recipient_id are required", 400);
      return;
    }

    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_role", recipientRole)
      .eq("recipient_id", recipientId)
      .eq("is_read", false);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "All notifications marked as read");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

export async function deleteNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Notification deleted");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

export async function deleteAllNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const recipientRole = req.body.recipient_role as string | undefined;
    const recipientId = req.body.recipient_id as string | undefined;

    if (!recipientRole || !recipientId) {
      sendError(res, "recipient_role and recipient_id are required", 400);
      return;
    }

    let query = supabaseAdmin
      .from("notifications")
      .delete()
      .eq("recipient_role", recipientRole)
      .eq("recipient_id", recipientId);

    const apartmentownerId = req.body.apartmentowner_id as string | undefined;
    if (apartmentownerId) {
      query = query.eq("apartmentowner_id", apartmentownerId);
    }

    const { error } = await query;

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "All notifications deleted");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

export async function sendTestSms(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { phone, message } = req.body as { phone?: string; message?: string };
    if (!phone || !message) {
      sendError(res, "phone and message are required", 400);
      return;
    }

    await sendSmsSemaphore(phone, message);
    sendSuccess(res, { phone }, "Test SMS sent");
  } catch (err: any) {
    sendError(res, err.message || "Failed to send test SMS", 500);
  }
}

export async function getSmsConfigStatus(_req: AuthenticatedRequest, res: Response): Promise<void> {
  sendSuccess(res, {
    sms_enabled: env.SMS_ENABLED !== "false",
    semaphore_api_key_configured: Boolean(env.SEMAPHORE_API_KEY),
    semaphore_sender_name: env.SEMAPHORE_SENDER_NAME || null,
    semaphore_api_url: env.SEMAPHORE_API_URL,
  });
}
