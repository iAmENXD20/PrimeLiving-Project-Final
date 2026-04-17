import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

const DOCUMENTS_BUCKET = "documents";

async function ensureDocumentsBucket(): Promise<void> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = (buckets || []).some((bucket) => bucket.name === DOCUMENTS_BUCKET);
  if (exists) return;

  await supabaseAdmin.storage.createBucket(DOCUMENTS_BUCKET, {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/jpg", "application/pdf"],
  });
}

function parseImageDataUrl(dataUrl: string): { mime: string; buffer: Buffer; extension: string } | null {
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
 * GET /api/apartments/occupants/:unitId
 * Get all occupants for a unit
 */
export async function getOccupants(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { unitId } = req.params;

    const { data, error } = await supabaseAdmin
      .from("unit_occupants")
      .select("*")
      .eq("unit_id", unitId)
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

/**
 * POST /api/apartments/occupants
 * Add an occupant to a unit
 */
export async function addOccupant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { unit_id, tenant_id, full_name, first_name, last_name, id_photo_url, birthdate } = req.body;

    const resolvedFullName = full_name || `${first_name || ''} ${last_name || ''}`.trim()

    if (!unit_id || !tenant_id || !resolvedFullName?.trim()) {
      sendError(res, "unit_id, tenant_id, and a name are required", 400);
      return;
    }

    // Check max_occupancy limit
    const { data: unit } = await supabaseAdmin
      .from("units")
      .select("max_occupancy")
      .eq("id", unit_id)
      .single();

    if (unit?.max_occupancy) {
      const { count } = await supabaseAdmin
        .from("unit_occupants")
        .select("*", { count: "exact", head: true })
        .eq("unit_id", unit_id);

      // +1 for the main tenant
      if ((count || 0) + 1 >= unit.max_occupancy) {
        sendError(
          res,
          `Maximum occupancy of ${unit.max_occupancy} reached (including main tenant)`,
          400
        );
        return;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("unit_occupants")
      .insert({
        unit_id,
        tenant_id,
        full_name: resolvedFullName,
        id_photo_url: id_photo_url || null,
        birthdate: birthdate || null,
      })
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Occupant added successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/apartments/occupants/:id
 * Update an occupant
 */
export async function updateOccupant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { full_name, id_photo_url } = req.body;

    const updates: any = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) updates.full_name = full_name.trim();
    if (id_photo_url !== undefined) updates.id_photo_url = id_photo_url;

    const { data, error } = await supabaseAdmin
      .from("unit_occupants")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Occupant updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/apartments/occupants/:id
 * Remove an occupant
 */
export async function deleteOccupant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("unit_occupants")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Occupant removed successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/apartments/occupants/upload-id
 * Upload occupant ID photo to Supabase Storage
 */
export async function uploadOccupantIdPhoto(
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

    const parsed = parseImageDataUrl(data_url);
    if (!parsed) {
      sendError(res, "Invalid image data", 400);
      return;
    }

    await ensureDocumentsBucket();

    const objectPath = `occupant-ids/${tenant_id}/${Date.now()}.${parsed.extension}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .upload(objectPath, parsed.buffer, {
        contentType: parsed.mime,
        upsert: true,
      });

    if (uploadError) {
      sendError(res, uploadError.message, 500);
      return;
    }

    const { data: publicData } = supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .getPublicUrl(objectPath);

    sendSuccess(
      res,
      { url: publicData.publicUrl, path: objectPath },
      "Occupant ID photo uploaded successfully",
      201
    );
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
