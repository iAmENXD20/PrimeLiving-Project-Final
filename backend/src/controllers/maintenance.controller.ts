import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, getManagerScope } from "../utils/helpers";
import { sendSmsToMany } from "../utils/sms";
import { createNotification, createNotifications } from "../utils/notifications";
import { logActivity, resolveActorName } from "../utils/activityLog";

const MAINTENANCE_PHOTO_BUCKET = "maintenance-photos";

async function ensureMaintenancePhotoBucket(): Promise<void> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = (buckets || []).some((bucket) => bucket.name === MAINTENANCE_PHOTO_BUCKET);
  if (exists) return;

  await supabaseAdmin.storage.createBucket(MAINTENANCE_PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/jpg"],
  });
}

function parseMaintenanceDataUrl(dataUrl: string): { mime: string; buffer: Buffer; extension: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const extension = extMap[mime];
  if (!extension) return null;

  return {
    mime,
    buffer: Buffer.from(match[2], "base64"),
    extension,
  };
}

/**
 * GET /api/maintenance
 * Get maintenance requests (filtered by apartmentowner_id or tenant_id)
 */
export async function getMaintenanceRequests(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("maintenance")
      .select("*")
      .order("created_at", { ascending: false });

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
    }
    if (req.query.manager_id) {
      const { unitIds } = await getManagerScope(req.query.manager_id as string);
      if (unitIds.length === 0) {
        sendSuccess(res, []);
        return;
      }
      query = query.in("unit_id", unitIds);
    }
    if (req.query.tenant_id) {
      query = query.eq("tenant_id", req.query.tenant_id as string);
    }
    if (req.query.status) {
      query = query.eq("status", req.query.status as string);
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
 * GET /api/maintenance/:id
 * Get a single maintenance request
 */
export async function getMaintenanceRequestById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("maintenance")
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
 * POST /api/maintenance
 * Create a new maintenance request (tenant submits)
 */
export async function createMaintenanceRequest(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { tenant_id, unit_id, apartmentowner_id, title, description, priority, photo_url } =
      req.body;

    const { data, error } = await supabaseAdmin
      .from("maintenance")
      .insert({
        tenant_id,
        unit_id,
        apartmentowner_id,
        title,
        description,
        priority,
        status: "pending",
        photo_url: photo_url || null,
      })
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    const [{ data: managersByOwner }, { data: tenant }] = await Promise.all([
      supabaseAdmin
        .from("apartment_managers")
        .select("id, phone")
        .eq("apartmentowner_id", apartmentowner_id)
        .eq("status", "active"),
      supabaseAdmin
        .from("tenants")
        .select("first_name, last_name")
        .eq("id", tenant_id)
        .maybeSingle(),
    ]);

    const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() || "tenant" : "tenant";

    let managers = managersByOwner || [];

    if (managers.length === 0 && unit_id) {
      const { data: apartment } = await supabaseAdmin
        .from("units")
        .select("manager_id")
        .eq("id", unit_id)
        .maybeSingle();

      if (apartment?.manager_id) {
        const { data: managerByApartment } = await supabaseAdmin
          .from("apartment_managers")
          .select("id, phone")
          .eq("id", apartment.manager_id)
          .eq("status", "active")
          .maybeSingle();

        if (managerByApartment) {
          managers = [managerByApartment];
        }
      }
    }

    await sendSmsToMany(
      (managers || []).map((manager: any) => manager.phone),
      `[PrimeLiving] New maintenance request from ${tenantName}: ${title} (${priority})`,
      { unit_id, apartmentowner_id }
    );

    await createNotifications(
      (managers || []).map((manager: any) => ({
        apartmentowner_id,
        unit_id,
        recipient_role: "manager" as const,
        recipient_id: manager.id,
        type: "maintenance_request_created",
        title: "New Maintenance Request",
        message: `${tenantName} submitted: ${title}`,
      }))
    );

    sendSuccess(res, data, "Maintenance request created successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/maintenance/:id/status
 * Update maintenance request status
 */
export async function updateMaintenanceStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabaseAdmin
      .from("maintenance")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    if (data?.tenant_id) {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("phone")
        .eq("id", data.tenant_id)
        .maybeSingle();

      await sendSmsToMany(
        [tenant?.phone],
        `[PrimeLiving] Your maintenance request "${data.title}" is now ${status.replace("_", " ")}.`,
        { unit_id: data.unit_id, apartmentowner_id: data.apartmentowner_id }
      );

      if (data.apartmentowner_id && data.tenant_id) {
        await createNotification({
          apartmentowner_id: data.apartmentowner_id,
          unit_id: data.unit_id,
          recipient_role: "tenant",
          recipient_id: data.tenant_id,
          type: "maintenance_status_updated",
          title: "Maintenance Update",
          message: `Your request "${data.title}" is now ${status.replace("_", " ")}.`,
        });
      }
    }

    sendSuccess(res, data, "Maintenance status updated successfully");

    if (data?.apartmentowner_id) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: data.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "manager",
        action: "maintenance_status_updated",
        entity_type: "maintenance",
        entity_id: id,
        description: `Maintenance "${data.title}" status changed to ${status}`,
        metadata: { title: data.title, status },
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/maintenance/count/pending
 * Get count of pending maintenance requests (filtered by apartmentowner_id)
 */
export async function getPendingMaintenanceCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("maintenance")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
    }

    const { count, error } = await query;

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, { count });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/maintenance/photos
 * Upload maintenance request photo to Supabase Storage
 */
export async function uploadMaintenancePhoto(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { tenant_id, data_url } = req.body as {
      tenant_id?: string;
      data_url?: string;
    };

    if (!tenant_id || !data_url) {
      sendError(res, "tenant_id and data_url are required", 400);
      return;
    }

    const parsed = parseMaintenanceDataUrl(data_url);
    if (!parsed) {
      sendError(res, "Invalid image data", 400);
      return;
    }

    await ensureMaintenancePhotoBucket();

    const objectPath = `${tenant_id}/${Date.now()}.${parsed.extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(MAINTENANCE_PHOTO_BUCKET)
      .upload(objectPath, parsed.buffer, {
        contentType: parsed.mime,
        upsert: false,
      });

    if (uploadError) {
      sendError(res, uploadError.message, 500);
      return;
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(MAINTENANCE_PHOTO_BUCKET)
      .getPublicUrl(objectPath);

    sendSuccess(
      res,
      { photo_url: publicData.publicUrl, path: objectPath },
      "Maintenance photo uploaded successfully",
      201
    );
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
