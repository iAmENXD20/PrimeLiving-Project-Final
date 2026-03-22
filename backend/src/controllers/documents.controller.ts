import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";
import { logActivity, resolveActorName } from "../utils/activityLog";

const DOCUMENTS_BUCKET = "documents-private";

async function ensureDocumentsBucket(): Promise<void> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = (buckets || []).some((bucket) => bucket.name === DOCUMENTS_BUCKET);
  if (exists) return;

  await supabaseAdmin.storage.createBucket(DOCUMENTS_BUCKET, {
    public: false,
    fileSizeLimit: "10MB",
    allowedMimeTypes: ["application/pdf"],
  });
}

function parseDocumentDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(application\/pdf);base64,(.+)$/i);
  if (!match) return null;
  return {
    mime: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], "base64"),
  };
}

function extractStoragePath(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) return null;

  if (!fileUrl.startsWith("http")) {
    return fileUrl;
  }

  const publicToken = "/storage/v1/object/public/documents/";
  const signedToken = "/storage/v1/object/sign/documents-private/";

  if (fileUrl.includes(publicToken)) {
    return fileUrl.split(publicToken)[1] || null;
  }

  if (fileUrl.includes(signedToken)) {
    const remainder = fileUrl.split(signedToken)[1] || "";
    return remainder.split("?")[0] || null;
  }

  return null;
}

/**
 * GET /api/documents
 * Get documents (filtered by apartmentowner_id)
 */
export async function getDocuments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    await ensureDocumentsBucket();

    const requesterRole = req.user?.role;
    const requesterAuthUserId = req.user?.id;

    let query = supabaseAdmin
      .from("documents")
      .select("*, tenants(name), apartments:unit_id(name)")
      .order("created_at", { ascending: false });

    if (requesterRole === "tenant") {
      const { data: tenantProfile, error: tenantProfileError } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("auth_user_id", requesterAuthUserId)
        .maybeSingle();

      if (tenantProfileError) {
        sendError(res, tenantProfileError.message, 500);
        return;
      }

      if (!tenantProfile?.id) {
        sendSuccess(res, []);
        return;
      }

      query = query.eq("tenant_id", tenantProfile.id);
    }

    if (req.query.apartmentowner_id) {
      query = query.eq("apartmentowner_id", req.query.apartmentowner_id as string);
    }
    if (req.query.unit_id) {
      query = query.eq("unit_id", req.query.unit_id as string);
    }
    if (req.query.tenant_id) {
      query = query.eq("tenant_id", req.query.tenant_id as string);
    }

    const { data, error } = await query;

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    const signedDocs = await Promise.all(
      (data || []).map(async (doc: any) => {
        const storagePath = extractStoragePath(doc.file_url);
        if (!storagePath) return doc;

        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from(DOCUMENTS_BUCKET)
          .createSignedUrl(storagePath, 60 * 60);

        if (signedError || !signedData?.signedUrl) return doc;

        return {
          ...doc,
          file_url: signedData.signedUrl,
        };
      })
    );

    sendSuccess(res, signedDocs);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/documents/:id
 * Get a single document
 */
export async function getDocumentById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("*, tenants(name), apartments:unit_id(name)")
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
 * POST /api/documents
 * Create a document record (file already uploaded to Supabase Storage from frontend)
 */
export async function createDocument(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("documents")
      .insert(req.body)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Document created successfully", 201);

    if (data && req.body.apartmentowner_id) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: req.body.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "manager",
        action: "document_created",
        entity_type: "document",
        entity_id: data.id,
        description: `Created document record: ${data.file_name || "untitled"}`,
        metadata: { file_name: data.file_name, file_type: data.file_type },
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/documents/upload
 * Upload a PDF to storage and create document record
 */
export async function uploadDocument(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const {
      apartmentowner_id,
      unit_id,
      tenant_id,
      uploaded_by,
      file_name,
      file_type,
      description,
      file_data,
    } = req.body as {
      apartmentowner_id?: string;
      unit_id?: string | null;
      tenant_id?: string | null;
      uploaded_by?: string | null;
      file_name?: string;
      file_type?: string;
      description?: string | null;
      file_data?: string;
    };

    if (!apartmentowner_id || !file_name || !file_type || !file_data) {
      sendError(res, "apartmentowner_id, file_name, file_type and file_data are required", 400);
      return;
    }

    if (file_type !== "application/pdf") {
      sendError(res, "Only PDF files are supported", 400);
      return;
    }

    const parsed = parseDocumentDataUrl(file_data);
    if (!parsed) {
      sendError(res, "Invalid PDF data format", 400);
      return;
    }

    await ensureDocumentsBucket();

    const safeFileName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectPath = `${apartmentowner_id}/${Date.now()}_${safeFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .upload(objectPath, parsed.buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      sendError(res, uploadError.message, 500);
      return;
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(objectPath, 60 * 60);

    if (signedError) {
      sendError(res, signedError.message, 500);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("documents")
      .insert({
        apartmentowner_id,
        unit_id: unit_id || null,
        tenant_id: tenant_id || null,
        uploaded_by: uploaded_by || null,
        file_name,
        file_url: objectPath,
        file_type,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove([objectPath]);
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(
      res,
      {
        ...data,
        file_url: signedData.signedUrl,
      },
      "Document uploaded successfully",
      201
    );

    logActivity({
      apartmentowner_id,
      actor_id: req.user?.id || null,
      actor_name: await (async () => {
        if (req.user?.id) return resolveActorName(req.user.id, req.user.role, req.user.email);
        return "System";
      })(),
      actor_role: (req.user?.role as "owner" | "manager") || "owner",
      action: "document_uploaded",
      entity_type: "document",
      entity_id: data.id,
      description: `Uploaded document: ${file_name}`,
      metadata: { file_name, file_type },
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/documents/:id
 * Delete a document (also removes from storage)
 */
export async function deleteDocument(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    await ensureDocumentsBucket();

    const { id } = req.params;

    // Get the document to find the storage path
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from("documents")
      .select("file_url, file_name, apartmentowner_id")
      .eq("id", id)
      .single();

    if (fetchError) {
      sendError(res, fetchError.message, 404);
      return;
    }

    // Extract the file path from the URL and delete from storage
    if (doc?.file_url) {
      const storagePath = extractStoragePath(doc.file_url);
      if (storagePath) {
        await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      }
    }

    // Delete the database record
    const { error } = await supabaseAdmin
      .from("documents")
      .delete()
      .eq("id", id);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, null, "Document deleted successfully");

    if (doc?.apartmentowner_id) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: doc.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "document_deleted",
        entity_type: "document",
        entity_id: id,
        description: `Deleted document: ${doc.file_name || "unknown"}`,
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
