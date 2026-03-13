import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

/**
 * GET /api/payments
 * Get payments (filtered by client_id or tenant_id)
 */
export async function getPayments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    let query = supabaseAdmin
      .from("payments")
      .select("*, tenants(name, email), apartments(name)")
      .order("created_at", { ascending: false });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
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
 * GET /api/payments/:id
 * Get a single payment
 */
export async function getPaymentById(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*, tenants(name, email), apartments(name)")
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
 * POST /api/payments
 * Create a new payment record
 */
export async function createPayment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert(req.body)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Payment created successfully", 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/payments/bulk
 * Create multiple payment records (for monthly billing generation)
 */
export async function createPaymentsBulk(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { payments } = req.body;

    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert(payments)
      .select();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, `${data.length} payment records created`, 201);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/payments/:id
 * Update a payment (status, verification_status, receipt_url, etc.)
 */
export async function updatePayment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabaseAdmin
      .from("payments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Payment updated successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/payments/:id/verify
 * Verify or reject a cash payment receipt
 */
export async function verifyPayment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { verification_status } = req.body; // "verified" or "rejected"

    const updateData: any = { verification_status };

    // If verified, also mark payment as paid
    if (verification_status === "verified") {
      updateData.status = "paid";
    }

    const { data, error } = await supabaseAdmin
      .from("payments")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, `Payment ${verification_status} successfully`);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * POST /api/payments/generate-monthly
 * Generate pending billings for the current month for a given client.
 * For each active tenant, if there's no payment for the current month, creates a pending payment.
 * Also marks past-due pending payments as overdue.
 */
export async function generateMonthlyBillings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { client_id } = req.body;

    if (!client_id) {
      sendError(res, "client_id is required", 400);
      return;
    }

    // 1. Get all apartments for this client
    const { data: apartments } = await supabaseAdmin
      .from("apartments")
      .select("id, payment_due_day, monthly_rent")
      .eq("client_id", client_id)
      .eq("status", "active");

    if (!apartments || apartments.length === 0) {
      sendSuccess(res, { created: 0 }, "No apartments found");
      return;
    }

    const apartmentIds = apartments.map((a: any) => a.id);
    const apartmentMap = new Map(apartments.map((a: any) => [a.id, a]));

    // 2. Get all active tenants
    const { data: allTenants } = await supabaseAdmin
      .from("tenants")
      .select("id, apartment_id")
      .in("apartment_id", apartmentIds)
      .eq("status", "active");

    if (!allTenants || allTenants.length === 0) {
      sendSuccess(res, { created: 0 }, "No active tenants found");
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = new Date(year, month, 1).toISOString().split("T")[0];
    const monthEnd = new Date(year, month + 1, 0).toISOString().split("T")[0];

    // 3. Get existing payments for this month
    const { data: existingPayments } = await supabaseAdmin
      .from("payments")
      .select("tenant_id, status")
      .eq("client_id", client_id)
      .gte("period_from", monthStart)
      .lte("period_from", monthEnd);

    const paidOrPendingTenants = new Set(
      (existingPayments || []).map((p: any) => p.tenant_id).filter(Boolean)
    );

    // 4. Create pending payments for tenants without a payment this month
    const newPayments: any[] = [];

    for (const tenant of allTenants) {
      if (paidOrPendingTenants.has(tenant.id)) continue;

      const apt = apartmentMap.get(tenant.apartment_id);
      if (!apt || !apt.payment_due_day) continue;

      const dueDay = Math.min(
        apt.payment_due_day,
        new Date(year, month + 1, 0).getDate()
      );
      const dueDate = new Date(year, month, dueDay);
      const isPastDue = now > dueDate;

      const monthName = new Date(year, month).toLocaleString("default", {
        month: "long",
        year: "numeric",
      });

      newPayments.push({
        client_id,
        tenant_id: tenant.id,
        apartment_id: tenant.apartment_id,
        amount: apt.monthly_rent || 0,
        payment_date: dueDate.toISOString(),
        status: isPastDue ? "overdue" : "pending",
        description: `Monthly rent - ${monthName}`,
        payment_mode: null,
        period_from: monthStart,
        period_to: monthEnd,
      });
    }

    if (newPayments.length > 0) {
      const { error } = await supabaseAdmin.from("payments").insert(newPayments);
      if (error) {
        sendError(res, error.message, 500);
        return;
      }
    }

    // 5. Mark existing pending payments as overdue if past due date
    for (const apt of apartments) {
      if (!apt.payment_due_day) continue;
      const dueDay = Math.min(
        apt.payment_due_day,
        new Date(year, month + 1, 0).getDate()
      );
      const dueDate = new Date(year, month, dueDay);

      if (now > dueDate) {
        await supabaseAdmin
          .from("payments")
          .update({ status: "overdue" })
          .eq("client_id", client_id)
          .eq("apartment_id", apt.id)
          .eq("status", "pending")
          .gte("period_from", monthStart)
          .lte("period_from", monthEnd);
      }
    }

    sendSuccess(
      res,
      { created: newPayments.length },
      `${newPayments.length} billing records created`
    );
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/payments/pending-verifications
 * Get cash payments pending verification for a client
 */
export async function getPendingVerifications(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const clientId = req.query.client_id as string;

    if (!clientId) {
      sendError(res, "client_id query parameter is required", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*, tenants:tenant_id(name), apartments:apartment_id(name)")
      .eq("client_id", clientId)
      .eq("payment_mode", "cash")
      .eq("verification_status", "pending_verification")
      .order("created_at", { ascending: false });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    const results = (data || []).map((p: any) => ({
      ...p,
      tenant_name: p.tenants?.name || null,
      apartment_name: p.apartments?.name || null,
      tenants: undefined,
      apartments: undefined,
    }));

    sendSuccess(res, results);
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
