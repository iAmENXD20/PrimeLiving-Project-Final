import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

/**
 * GET /api/documents
 * Get documents (filtered by client_id)
 */
export async function getDocuments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
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

    sendSuccess(res, data);
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
 * DELETE /api/documents/:id
 * Delete a document (also removes from storage)
 */
export async function deleteDocument(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
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
      const urlParts = doc.file_url.split("/storage/v1/object/public/documents/");
      if (urlParts[1]) {
        await supabaseAdmin.storage.from("documents").remove([urlParts[1]]);
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
