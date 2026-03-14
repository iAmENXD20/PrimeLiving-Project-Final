import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { sendSmsToMany } from "../utils/sms";
import { createNotifications } from "../utils/notifications";

/**
 * GET /api/announcements
 * Get announcements (filtered by client_id)
 */
export async function getAnnouncements(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("announcements")
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
 * GET /api/announcements/:id
 * Get a single announcement
 */
export async function getAnnouncementById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("announcements")
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
 * POST /api/announcements
 * Create a new announcement
 */
export async function createAnnouncement(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { client_id, title, message } = req.body;

    const { data, error } = await supabaseAdmin
      .from("announcements")
      .insert(req.body)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    if (client_id) {
      const { data: tenants } = await supabaseAdmin
        .from("tenants")
        .select("id, phone")
        .eq("client_id", client_id)
        .eq("status", "active");

      await sendSmsToMany(
        (tenants || []).map((tenant: any) => tenant.phone),
        `[PrimeLiving Announcement] ${title}: ${message}`
      );

      await createNotifications(
        (tenants || []).map((tenant: any) => ({
          client_id,
          recipient_role: "tenant" as const,
          recipient_id: tenant.id,
          type: "announcement_created",
          title,
          message,
        }))
      );
    }

    sendSuccess(res, data, "Announcement created successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/announcements/:id
 * Delete an announcement
 */
export async function deleteAnnouncement(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Announcement deleted successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
