import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
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

    const isMissingAnnouncementsTable =
      Boolean(error) &&
      /Could not find the table 'public\.announcements'|relation "announcements" does not exist/i.test(
        error?.message || ""
      );

    if (error && !isMissingAnnouncementsTable) {
      sendError(res, error.message, 500);
      return;
    }

    if (client_id) {
      const { data: tenants } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("client_id", client_id)
        .eq("status", "active");

      const tenantNotifications = (tenants || []).map((tenant: any) => ({
        client_id,
        recipient_role: "tenant" as const,
        recipient_id: tenant.id,
        type: "announcement_created",
        title,
        message,
      }));

      const managerNotifications: Array<{
        client_id: string;
        recipient_role: "manager";
        recipient_id: string;
        type: string;
        title: string;
        message: string;
      }> = [];

      if (req.user?.role === "owner") {
        const { data: managers } = await supabaseAdmin
          .from("managers")
          .select("id")
          .eq("client_id", client_id)
          .eq("status", "active");

        managerNotifications.push(
          ...(managers || []).map((manager: any) => ({
            client_id,
            recipient_role: "manager" as const,
            recipient_id: manager.id,
            type: "announcement_created",
            title,
            message,
          }))
        );
      }

      await createNotifications([...tenantNotifications, ...managerNotifications]);
    }

    sendSuccess(
      res,
      data || {
        id: null,
        client_id,
        title,
        message,
        created_by: req.body?.created_by || req.user?.email || null,
        created_at: new Date().toISOString(),
        notification_only: true,
      },
      isMissingAnnouncementsTable
        ? "Announcement notification sent (announcement table is unavailable)"
        : "Announcement created successfully",
      201
    );
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
