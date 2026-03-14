import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError } from "../utils/helpers";

const PAYMENT_QR_BUCKET = "payment-qr-codes";

async function ensurePaymentQrBucket(): Promise<void> {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = (buckets || []).some((bucket) => bucket.name === PAYMENT_QR_BUCKET);
  if (exists) return;

  await supabaseAdmin.storage.createBucket(PAYMENT_QR_BUCKET, {
    public: false,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/jpg"],
  });
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  return { mime, buffer: Buffer.from(base64, "base64") };
}

/**
 * GET /api/payments
 * Get payments (filtered by client_id or tenant_id)
 */
export async function getPayments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.query.tenant_id as string | undefined;

    let query = supabaseAdmin
      .from("payments")
      .select("*, tenants(name, email), apartments(name)")
      .order("created_at", { ascending: false });

    if (req.query.client_id) {
      query = query.eq("client_id", req.query.client_id as string);
    }
    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
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
 * GET /api/payments/due-schedule/:tenantId
 * Returns read-only monthly due schedule (pending/overdue) based on tenant move-in day.
 */
export async function getTenantDueSchedule(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { tenantId } = req.params;
    if (!tenantId) {
      sendError(res, "tenantId is required", 400);
      return;
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, client_id, apartment_id, move_in_date, status")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      sendError(res, "Tenant not found", 404);
      return;
    }

    if (!tenant.apartment_id || !tenant.move_in_date) {
      sendSuccess(res, []);
      return;
    }

    const { data: apartment } = await supabaseAdmin
      .from("apartments")
      .select("monthly_rent")
      .eq("id", tenant.apartment_id)
      .single();

    const monthlyRent = Number(apartment?.monthly_rent || 0);
    const moveInDate = new Date(tenant.move_in_date);
    if (Number.isNaN(moveInDate.getTime())) {
      sendSuccess(res, []);
      return;
    }

    const { data: paymentRows } = await supabaseAdmin
      .from("payments")
      .select("id, status, verification_status, amount, period_from, period_to, payment_date")
      .eq("tenant_id", tenantId);

    const existingByPeriodStart = new Map<string, any>();
    (paymentRows || []).forEach((row: any) => {
      if (row.period_from) {
        existingByPeriodStart.set(String(row.period_from), row);
      }
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const GRACE_DAYS = 3;

    const toLocalDateString = (value: Date) => {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const addOneMonthSameDay = (date: Date): Date => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      const targetLastDay = new Date(year, month + 2, 0).getDate();
      return new Date(year, month + 1, Math.min(day, targetLastDay));
    };

    const rowsToInsert: any[] = [];
    const pendingToOverdueIds: string[] = [];

    for (let periodStart = new Date(moveInDate); periodStart <= today; periodStart = addOneMonthSameDay(periodStart)) {
      const periodEnd = addOneMonthSameDay(periodStart);
      const dueDate = new Date(periodEnd);
      const overdueAt = new Date(dueDate);
      overdueAt.setDate(overdueAt.getDate() + GRACE_DAYS);

      const periodFrom = toLocalDateString(periodStart);
      const periodTo = toLocalDateString(periodEnd);
      const shouldBeOverdue = today > overdueAt;
      const existing = existingByPeriodStart.get(periodFrom);

      if (!existing) {
        rowsToInsert.push({
          client_id: tenant.client_id,
          tenant_id: tenant.id,
          apartment_id: tenant.apartment_id,
          amount: monthlyRent,
          payment_date: dueDate.toISOString(),
          status: shouldBeOverdue ? "overdue" : "pending",
          description: `Monthly rent - ${periodFrom} to ${periodTo}`,
          payment_mode: null,
          receipt_url: null,
          verification_status: null,
          period_from: periodFrom,
          period_to: periodTo,
        });
        continue;
      }

      const isPaid = existing.status === "paid" || existing.verification_status === "verified";
      if (!isPaid && existing.status === "pending" && shouldBeOverdue) {
        pendingToOverdueIds.push(existing.id);
      }
    }

    if (rowsToInsert.length > 0) {
      await supabaseAdmin.from("payments").insert(rowsToInsert);
    }

    if (pendingToOverdueIds.length > 0) {
      await supabaseAdmin
        .from("payments")
        .update({ status: "overdue" })
        .in("id", pendingToOverdueIds);
    }

    const { data: dueRows, error: dueRowsError } = await supabaseAdmin
      .from("payments")
      .select("id, period_from, period_to, payment_date, amount, status, verification_status")
      .eq("tenant_id", tenantId)
      .in("status", ["pending", "overdue"])
      .order("period_from", { ascending: true });

    if (dueRowsError) {
      sendError(res, dueRowsError.message, 500);
      return;
    }

    const visibleDueRows = (dueRows || []).filter((row: any) => row.verification_status !== "pending_verification");
    sendSuccess(res, visibleDueRows);
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
 * POST /api/payments/submit-proof
 * Tenant submits payment proof for an existing billing period row.
 */
export async function submitPaymentProof(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const {
      tenant_id,
      client_id,
      apartment_id,
      amount,
      receipt_url,
      period_from,
      period_to,
      description,
    } = req.body;

    if (!tenant_id || !client_id || !period_from || !period_to || !receipt_url) {
      sendError(res, "tenant_id, client_id, period_from, period_to, and receipt_url are required", 400);
      return;
    }

    const { data: existing } = await supabaseAdmin
      .from("payments")
      .select("id, status")
      .eq("tenant_id", tenant_id)
      .eq("period_from", period_from)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabaseAdmin
        .from("payments")
        .update({
          receipt_url,
          payment_mode: "qr",
          verification_status: "pending_verification",
          description: description || `Payment proof submitted for ${period_from} to ${period_to}`,
          amount: amount ?? undefined,
          apartment_id: apartment_id || null,
          client_id,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        sendError(res, error.message, 500);
        return;
      }

      sendSuccess(res, data, "Payment proof submitted successfully");
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert({
        tenant_id,
        client_id,
        apartment_id: apartment_id || null,
        amount: amount || 0,
        payment_date: new Date().toISOString(),
        status: "pending",
        payment_mode: "qr",
        receipt_url,
        verification_status: "pending_verification",
        period_from,
        period_to,
        description: description || `Payment proof submitted for ${period_from} to ${period_to}`,
      })
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Payment proof submitted successfully", 201);
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

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, client_id, apartment_id, amount, payment_date")
      .eq("id", id)
      .single();

    if (paymentError || !payment) {
      sendError(res, "Payment not found", 404);
      return;
    }

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

    if (verification_status === "verified") {
      const revenueDescription = `Verified payment: ${id}`;

      const { data: existingRevenue } = await supabaseAdmin
        .from("revenues")
        .select("id")
        .eq("client_id", payment.client_id)
        .eq("description", revenueDescription)
        .maybeSingle();

      if (!existingRevenue) {
        await supabaseAdmin.from("revenues").insert({
          apartment_id: payment.apartment_id,
          client_id: payment.client_id,
          amount: payment.amount,
          month: payment.payment_date || new Date().toISOString(),
          description: revenueDescription,
        });
      }
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

/**
 * POST /api/payments/qr
 * Upload or replace owner's payment QR image in Supabase Storage
 */
export async function uploadPaymentQr(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { client_id, data_url } = req.body as {
      client_id?: string;
      data_url?: string;
    };

    if (!client_id || !data_url) {
      sendError(res, "client_id and data_url are required", 400);
      return;
    }

    const parsed = parseDataUrl(data_url);
    if (!parsed) {
      sendError(res, "Invalid image data format", 400);
      return;
    }

    const allowed = ["image/png", "image/jpeg", "image/webp", "image/jpg"];
    if (!allowed.includes(parsed.mime)) {
      sendError(res, "Unsupported image type", 400);
      return;
    }

    await ensurePaymentQrBucket();

    const objectPath = `${client_id}/payment-qr`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(PAYMENT_QR_BUCKET)
      .upload(objectPath, parsed.buffer, {
        contentType: parsed.mime,
        upsert: true,
      });

    if (uploadError) {
      sendError(res, uploadError.message, 500);
      return;
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(PAYMENT_QR_BUCKET)
      .createSignedUrl(objectPath, 60 * 60);

    if (signedError) {
      sendError(res, signedError.message, 500);
      return;
    }

    sendSuccess(
      res,
      { client_id, path: objectPath, qr_url: signedData.signedUrl },
      "Payment QR uploaded successfully"
    );
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/payments/qr/:clientId
 * Get signed URL for owner's payment QR image
 */
export async function getPaymentQr(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { clientId } = req.params;
    if (!clientId) {
      sendError(res, "clientId is required", 400);
      return;
    }

    await ensurePaymentQrBucket();
    const objectPath = `${clientId}/payment-qr`;

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(PAYMENT_QR_BUCKET)
      .createSignedUrl(objectPath, 60 * 60);

    if (signedError) {
      sendError(res, "QR code not found", 404);
      return;
    }

    sendSuccess(res, { client_id: clientId, qr_url: signedData.signedUrl });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/payments/qr/by-apartment/:apartmentId
 * Resolve apartment -> client_id then return signed QR URL
 */
export async function getPaymentQrByApartment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { apartmentId } = req.params;
    if (!apartmentId) {
      sendError(res, "apartmentId is required", 400);
      return;
    }

    const { data: apartment, error: apartmentError } = await supabaseAdmin
      .from("apartments")
      .select("client_id")
      .eq("id", apartmentId)
      .single();

    if (apartmentError || !apartment?.client_id) {
      sendError(res, "Owner not found for this apartment", 404);
      return;
    }

    await ensurePaymentQrBucket();
    const objectPath = `${apartment.client_id}/payment-qr`;

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(PAYMENT_QR_BUCKET)
      .createSignedUrl(objectPath, 60 * 60);

    if (signedError) {
      sendError(res, "QR code not found", 404);
      return;
    }

    sendSuccess(res, { client_id: apartment.client_id, qr_url: signedData.signedUrl });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/payments/qr/by-tenant/:tenantId
 * Resolve tenant -> apartment -> client_id then return signed QR URL
 */
export async function getPaymentQrByTenant(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { tenantId } = req.params;
    if (!tenantId) {
      sendError(res, "tenantId is required", 400);
      return;
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("id, apartment_id, client_id")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      sendError(res, "Tenant not found", 404);
      return;
    }

    let resolvedClientId: string | null = tenant.client_id || null;

    if (!resolvedClientId && tenant.apartment_id) {
      const { data: apartment } = await supabaseAdmin
        .from("apartments")
        .select("client_id")
        .eq("id", tenant.apartment_id)
        .single();
      resolvedClientId = apartment?.client_id || null;
    }

    if (!resolvedClientId) {
      sendError(res, "Owner not found for this tenant", 404);
      return;
    }

    await ensurePaymentQrBucket();
    const objectPath = `${resolvedClientId}/payment-qr`;

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(PAYMENT_QR_BUCKET)
      .createSignedUrl(objectPath, 60 * 60);

    if (signedError) {
      sendError(res, "QR code not found", 404);
      return;
    }

    sendSuccess(res, { tenant_id: tenantId, client_id: resolvedClientId, qr_url: signedData.signedUrl });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/payments/qr/:clientId
 * Remove owner's payment QR image from Supabase Storage
 */
export async function deletePaymentQr(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { clientId } = req.params;
    if (!clientId) {
      sendError(res, "clientId is required", 400);
      return;
    }

    await ensurePaymentQrBucket();
    const objectPath = `${clientId}/payment-qr`;
    const { error } = await supabaseAdmin.storage
      .from(PAYMENT_QR_BUCKET)
      .remove([objectPath]);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, { client_id: clientId }, "Payment QR removed successfully");
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
