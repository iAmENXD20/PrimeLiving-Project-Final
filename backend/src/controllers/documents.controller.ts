import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

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
 * Get documents (filtered by client_id)
 */
export async function getDocuments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    await ensureDocumentsBucket();

    let query = supabaseAdmin
      .from("documents")
      .select("*, tenants(name), apartments(name)")
      .order("created_at", { ascending: false });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
    }
    if (req.query.apartment_id) {
      query = query.eq("apartment_id", req.query.apartment_id as string);
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
      .select("*, tenants(name), apartments(name)")
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
      client_id,
      apartment_id,
      tenant_id,
      uploaded_by,
      file_name,
      file_type,
      description,
      file_data,
    } = req.body as {
      client_id?: string;
      apartment_id?: string | null;
      tenant_id?: string | null;
      uploaded_by?: string | null;
      file_name?: string;
      file_type?: string;
      description?: string | null;
      file_data?: string;
    };

    if (!client_id || !file_name || !file_type || !file_data) {
      sendError(res, "client_id, file_name, file_type and file_data are required", 400);
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
    const objectPath = `${client_id}/${Date.now()}_${safeFileName}`;

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
        client_id,
        apartment_id: apartment_id || null,
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
      .select("file_url")
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
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
