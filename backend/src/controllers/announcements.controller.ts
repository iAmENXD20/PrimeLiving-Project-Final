import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, getManagerScope } from "../utils/helpers";
import { createNotifications, createNotification } from "../utils/notifications";
import { sendSmsToMany } from "../utils/sms";
import { logActivity, resolveActorName } from "../utils/activityLog";
import { sendEmail, announcementEmailHtml, announcementReplyEmailHtml } from "../utils/email";

/**
 * GET /api/announcements
 * Get announcements (filtered by apartmentowner_id)
 */
export async function getAnnouncements(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
    }

    if (req.query.manager_id) {
      const { apartmentIds } = await getManagerScope(req.query.manager_id as string);
      if (apartmentIds.length === 0) {
        sendSuccess(res, []);
        return;
      }
      query = query.in("apartment_id", apartmentIds);
    }

    if (req.query.tenant_id) {
      const tenantId = req.query.tenant_id as string;
      query = query.or(
        `recipient_tenant_ids.is.null,recipient_tenant_ids.cs.{${tenantId}}`
      );
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
    const { apartmentowner_id, title, message } = req.body;
    const senderName =
      typeof req.body.created_by === "string" && req.body.created_by.trim().length > 0
        ? req.body.created_by.trim()
        : req.user?.email || "System";
    const senderRoleLabel = req.user?.role === "owner" ? "Owner" : "Manager";
    const notificationTitle = `Announcement sent by ${senderName} (${senderRoleLabel})`;
    const notificationMessage = `${title}\n\n${message}`;
    const recipientTenantIds = Array.isArray(req.body.recipient_tenant_ids)
      ? Array.from(
          new Set(
            req.body.recipient_tenant_ids.filter(
              (value: unknown): value is string =>
                typeof value === "string" && value.trim().length > 0
            )
          )
        )
      : [];

    const insertPayload = {
      apartmentowner_id,
      title,
      message,
      created_by: senderName,
      recipient_tenant_ids:
        recipientTenantIds.length > 0 ? recipientTenantIds : null,
    };

    const { data, error } = await supabaseAdmin
      .from("announcements")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    if (apartmentowner_id) {
      let tenantQuery = supabaseAdmin
        .from("tenants")
        .select("id, phone")
        .eq("apartmentowner_id", apartmentowner_id)
        .eq("status", "active");

      if (recipientTenantIds.length > 0) {
        tenantQuery = tenantQuery.in("id", recipientTenantIds);
      }

      const { data: tenants } = await tenantQuery;

      const tenantNotifications = (tenants || []).map((tenant: any) => ({
        apartmentowner_id,
        recipient_role: "tenant" as const,
        recipient_id: tenant.id,
        type: "announcement_created",
        title: notificationTitle,
        message: notificationMessage,
        entity_id: data.id,
      }));

      const managerNotifications: Array<{
        apartmentowner_id: string;
        recipient_role: "manager";
        recipient_id: string;
        type: string;
        title: string;
        message: string;
      }> = [];

      if (req.user?.role === "owner") {
        const { data: managers } = await supabaseAdmin
          .from("apartment_managers")
          .select("id")
          .eq("apartmentowner_id", apartmentowner_id)
          .eq("status", "active");

        managerNotifications.push(
          ...(managers || []).map((manager: any) => ({
            apartmentowner_id,
            recipient_role: "manager" as const,
            recipient_id: manager.id,
            type: "announcement_created",
            title: notificationTitle,
            message: notificationMessage,
            entity_id: data.id,
          }))
        );
      }

      await createNotifications([...tenantNotifications, ...managerNotifications]);

      // Send SMS to tenants with phone numbers
      const tenantPhones = (tenants || [])
        .map((t: any) => t.phone)
        .filter(Boolean);

      if (tenantPhones.length > 0) {
        const smsMessage = `${title}\n\n${message}`;
        sendSmsToMany(tenantPhones, smsMessage, { apartmentowner_id }).catch(
          (err) => console.error("Announcement SMS failed:", err)
        );
      }

      // Send emails to tenants with email addresses
      const tenantEmailsQuery = supabaseAdmin
        .from("tenants")
        .select("first_name, last_name, email")
        .eq("apartmentowner_id", apartmentowner_id)
        .eq("status", "active")
        .not("email", "is", null);

      const filteredEmailQuery = recipientTenantIds.length > 0
        ? tenantEmailsQuery.in("id", recipientTenantIds)
        : tenantEmailsQuery;

      const { data: tenantEmailData } = await filteredEmailQuery;
      for (const t of tenantEmailData || []) {
        if (!t.email) continue;
        sendEmail({
          to: t.email,
          subject: `New Announcement: ${title}`,
          html: announcementEmailHtml({
            tenantName: `${t.first_name} ${t.last_name}`.trim() || t.email,
            senderName,
            senderRole: senderRoleLabel,
            title,
            message,
          }),
        }).catch((err) => console.error("Announcement email failed:", err));
      }
    }

    sendSuccess(
      res,
      data,
      "Announcement created successfully",
      201
    );

    if (apartmentowner_id) {
      logActivity({
        apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: senderName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "announcement_created",
        entity_type: "announcement",
        entity_id: data.id,
        description: `Created announcement: ${title}`,
        metadata: { title },
      });
    }
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

    // Fetch announcement before deletion for logging
    const { data: announcement } = await supabaseAdmin
      .from("announcements")
      .select("title, apartmentowner_id")
      .eq("id", id)
      .single();

    const { error } = await supabaseAdmin
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Announcement deleted successfully");

    if (announcement) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: announcement.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "announcement_deleted",
        entity_type: "announcement",
        entity_id: id,
        description: `Deleted announcement: ${announcement.title}`,
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/announcements/:id/replies
 * Tenant replies to an announcement
 */
export async function createAnnouncementReply(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id: announcementId } = req.params;
    const { message } = req.body;

    if (!message?.trim()) {
      sendError(res, "Reply message is required", 400);
      return;
    }

    // Get tenant profile from auth user
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from("tenants")
      .select("id, first_name, last_name")
      .eq("auth_user_id", req.user!.id)
      .maybeSingle();

    if (tenantErr || !tenant) {
      sendError(res, "Tenant profile not found", 404);
      return;
    }

    const tenantFullName = `${tenant.first_name} ${tenant.last_name}`.trim();

    // Get the announcement details
    const { data: announcement, error: annErr } = await supabaseAdmin
      .from("announcements")
      .select("id, title, apartmentowner_id")
      .eq("id", announcementId)
      .single();

    if (annErr || !announcement) {
      sendError(res, "Announcement not found", 404);
      return;
    }

    // Insert the reply
    const { data: reply, error: replyErr } = await supabaseAdmin
      .from("announcement_replies")
      .insert({
        announcement_id: announcementId,
        tenant_id: tenant.id,
        tenant_name: tenantFullName,
        message: message.trim(),
      })
      .select()
      .single();

    if (replyErr) {
      sendError(res, replyErr.message, 500);
      return;
    }

    sendSuccess(res, reply, "Reply sent successfully", 201);

    // Notify all active managers for this owner
    const ownerId = announcement.apartmentowner_id;
    const { data: managers } = await supabaseAdmin
      .from("apartment_managers")
      .select("id, email, first_name, last_name")
      .eq("apartmentowner_id", ownerId)
      .eq("status", "active");

    const { data: owner } = await supabaseAdmin
      .from("apartment_owners")
      .select("id, first_name, last_name, email")
      .eq("id", ownerId)
      .maybeSingle();

    const notifTitle = `${tenantFullName} replied to your announcement`;
    const notifMsg = `"${announcement.title}"\n\nReply: ${message.trim()}`;

    // In-app notifications for managers
    const managerNotifs = (managers || []).map((mgr: any) => ({
      apartmentowner_id: ownerId,
      recipient_role: "manager" as const,
      recipient_id: mgr.id,
      type: "announcement_reply",
      title: notifTitle,
      message: notifMsg,
      entity_id: announcementId,
    }));

    if (managerNotifs.length > 0) {
      createNotifications(managerNotifs).catch((err) =>
        console.error("Failed to create reply notifications:", err)
      );
    }

    // Email managers and owner
    const emailRecipients: { name: string; email: string }[] = [];
    if (owner?.email) emailRecipients.push({ name: `${owner.first_name} ${owner.last_name}`.trim(), email: owner.email });
    for (const mgr of managers || []) {
      if (mgr.email) emailRecipients.push({ name: `${mgr.first_name} ${mgr.last_name}`.trim(), email: mgr.email });
    }

    for (const recipient of emailRecipients) {
      sendEmail({
        to: recipient.email,
        subject: `Tenant Reply: ${announcement.title}`,
        html: announcementReplyEmailHtml({
          recipientName: recipient.name || recipient.email,
          tenantName: tenantFullName,
          announcementTitle: announcement.title,
          replyMessage: message.trim(),
        }),
      }).catch((err) => console.error("Reply email failed:", err));
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/announcements/:id/replies
 * Owner/Manager gets all replies for an announcement
 */
export async function getAnnouncementReplies(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id: announcementId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("announcement_replies")
      .select("*")
      .eq("announcement_id", announcementId)
      .order("created_at", { ascending: true });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data || []);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
