import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

/**
 * GET /api/inquiries
 * Get all inquiries (optionally filtered by status)
 */
export async function getInquiries(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false });

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
 * GET /api/inquiries/:id
 * Get a single inquiry by ID
 */
export async function getInquiryById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("inquiries")
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
 * POST /api/inquiries
 * Create a new inquiry (from the landing page contact form -- public, no auth)
 */
export async function createInquiry(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { name, email, phone, apartment_name, message } = req.body;

    const { data, error } = await supabaseAdmin
      .from("inquiries")
      .insert({
        name,
        email,
        phone,
        apartment_name,
        message,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Inquiry submitted successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/inquiries/:id/status
 * Update inquiry status (pending -> responded/approved/cancelled/closed)
 */
export async function updateInquiryStatus(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabaseAdmin
      .from("inquiries")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Inquiry status updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/inquiries/count/pending
 * Get count of pending inquiries
 */
export async function getPendingInquiryCount(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { count, error } = await supabaseAdmin
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, { count });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
