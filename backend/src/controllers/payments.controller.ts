import { Response } from "express";
import { supabaseAdmin } from "../config/supabase";
import { AuthenticatedRequest } from "../types";
import { sendSuccess, sendError, getManagerScope } from "../utils/helpers";
import { sendSmsToMany } from "../utils/sms";
import { createNotification, createNotifications } from "../utils/notifications";
import { logActivity, resolveActorName } from "../utils/activityLog";

const PAYMENT_QR_BUCKET = "payment-qr-codes";

/** Resolve the parent apartment_id from a unit_id */
async function resolveApartmentId(unitId: string | null | undefined): Promise<string | null> {
  if (!unitId) return null;
  const { data } = await supabaseAdmin
    .from("units")
    .select("apartment_id")
    .eq("id", unitId)
    .single();
  return data?.apartment_id || null;
}

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
 * Get payments (filtered by apartmentowner_id or tenant_id)
 */
export async function getPayments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const tenantId = req.query.tenant_id as string | undefined;

    let query = supabaseAdmin
      .from("payments")
      .select("*, tenants(first_name, last_name, email), apartments:unit_id(name)")
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
      .select("id, apartmentowner_id, unit_id, move_in_date, status")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      sendError(res, "Tenant not found", 404);
      return;
    }

    if (!tenant.unit_id || !tenant.move_in_date) {
      sendSuccess(res, []);
      return;
    }

    const { data: apartment } = await supabaseAdmin
      .from("units")
      .select("monthly_rent, rent_deadline")
      .eq("id", tenant.unit_id)
      .single();

    const monthlyRent = Number(apartment?.monthly_rent || 0);
    const rentDeadline = apartment?.rent_deadline ? new Date(apartment.rent_deadline) : null;
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
      const periodFrom = toLocalDateString(periodStart);
      const periodTo = toLocalDateString(periodEnd);

      // Use rent_deadline if it falls within this billing period, otherwise use period end
      let dueDate: Date;
      if (rentDeadline && rentDeadline >= periodStart && rentDeadline <= periodEnd) {
        dueDate = new Date(rentDeadline);
      } else {
        dueDate = new Date(periodEnd);
      }

      const overdueAt = new Date(dueDate);
      overdueAt.setDate(overdueAt.getDate() + GRACE_DAYS);

      const shouldBeOverdue = today > overdueAt;
      const existing = existingByPeriodStart.get(periodFrom);

      if (!existing) {
        rowsToInsert.push({
          apartmentowner_id: tenant.apartmentowner_id,
          tenant_id: tenant.id,
          unit_id: tenant.unit_id,
          apartment_id: await resolveApartmentId(tenant.unit_id),
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

      const isPaid = existing.status === "paid" || (existing.verification_status != null && existing.verification_status !== "rejected");
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
      .select("*, tenants(first_name, last_name, email), apartments:unit_id(name)")
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
    const body = { ...req.body };
    if (!body.apartment_id && body.unit_id) {
      body.apartment_id = await resolveApartmentId(body.unit_id);
    }
    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert(body)
      .select()
      .single();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, "Payment created successfully", 201);

    if (data && req.body.apartmentowner_id && (req.user?.role === "owner" || req.user?.role === "manager")) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: req.body.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: req.user?.role as "owner" | "manager",
        action: "payment_created",
        entity_type: "payment",
        entity_id: data.id,
        description: `Created payment record â€” Amount: ${data.amount || 0}`,
        metadata: { amount: data.amount, status: data.status, tenant_id: data.tenant_id },
      });
    }
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
      apartmentowner_id,
      unit_id,
      amount,
      receipt_url,
      period_from,
      period_to,
      description,
      payment_mode,
    } = req.body;

    if (!tenant_id || !apartmentowner_id || !period_from || !period_to || !receipt_url) {
      sendError(res, "tenant_id, apartmentowner_id, period_from, period_to, and receipt_url are required", 400);
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
          payment_mode: payment_mode || "gcash",
          verification_status: "pending_verification",
          status: "pending",
          description: description || `Payment proof submitted for ${period_from} to ${period_to}`,
          amount: amount ?? undefined,
          unit_id: unit_id || null,
          apartmentowner_id,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        sendError(res, error.message, 500);
        return;
      }

      const [{ data: managers }, { data: tenant }] = await Promise.all([
        supabaseAdmin
          .from("apartment_managers")
          .select("phone")
          .eq("apartmentowner_id", apartmentowner_id)
          .eq("status", "active"),
        supabaseAdmin
          .from("tenants")
          .select("first_name, last_name")
          .eq("id", tenant_id)
          .maybeSingle(),
      ]);

      const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() || "A tenant" : "A tenant";

      await sendSmsToMany(
        (managers || []).map((manager: any) => manager.phone),
        `[E-AMS] ${tenantName} submitted payment proof for ${period_from} to ${period_to}. Please review.`,
        { unit_id: unit_id || null, apartmentowner_id }
      );

      await createNotifications(
        (managers || []).map((manager: any) => ({
          apartmentowner_id,
          unit_id: unit_id || null,
          recipient_role: "manager" as const,
          recipient_id: manager.id,
          type: "payment_proof_submitted",
          title: "Payment Proof Submitted",
          message: `${tenantName} submitted payment proof for ${period_from} to ${period_to}.`,
        }))
      );

      sendSuccess(res, data, "Payment proof submitted successfully");

      return;
    }

    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert({
        tenant_id,
        apartmentowner_id,
        unit_id: unit_id || null,
        apartment_id: await resolveApartmentId(unit_id),
        amount: amount || 0,
        payment_date: new Date().toISOString(),
        status: "pending",
        payment_mode: payment_mode || "gcash",
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

    const [{ data: managers }, { data: tenant }] = await Promise.all([
      supabaseAdmin
        .from("apartment_managers")
        .select("phone")
        .eq("apartmentowner_id", apartmentowner_id)
        .eq("status", "active"),
      supabaseAdmin
        .from("tenants")
        .select("first_name, last_name")
        .eq("id", tenant_id)
        .maybeSingle(),
    ]);

    const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() || "A tenant" : "A tenant";

    await sendSmsToMany(
      (managers || []).map((manager: any) => manager.phone),
      `[E-AMS] ${tenantName} submitted payment proof for ${period_from} to ${period_to}. Please review.`,
      { unit_id: unit_id || null, apartmentowner_id }
    );

    await createNotifications(
      (managers || []).map((manager: any) => ({
        apartmentowner_id,
        unit_id: unit_id || null,
        recipient_role: "manager" as const,
        recipient_id: manager.id,
        type: "payment_proof_submitted",
        title: "Payment Proof Submitted",
        message: `${tenantName} submitted payment proof for ${period_from} to ${period_to}.`,
      }))
    );

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

    // Resolve apartment_id for each payment if missing
    const enriched = await Promise.all(
      (payments as any[]).map(async (p: any) => {
        if (!p.apartment_id && p.unit_id) {
          return { ...p, apartment_id: await resolveApartmentId(p.unit_id) };
        }
        return p;
      })
    );

    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert(enriched)
      .select();

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, data, `${data.length} payment records created`, 201);

    const ownerIdForLog = payments?.[0]?.apartmentowner_id;
    if (data && ownerIdForLog) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: ownerIdForLog,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "payments_bulk_created",
        entity_type: "payment",
        entity_id: data[0]?.id || null,
        description: `Created ${data.length} payment records in bulk`,
        metadata: { count: data.length },
      });
    }
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
    const { status, verification_status, ...safeUpdates } = req.body;

    // Allow status changes except setting to 'paid' (must use /approve route).
    // verification_status is always blocked â€” must use /verify or /approve routes.
    const updates: Record<string, unknown> = { ...safeUpdates };
    if (status && status !== 'paid') {
      updates.status = status;
    }

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

    if (data && data.apartmentowner_id && (req.user?.role === "owner" || req.user?.role === "manager")) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: data.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: req.user?.role as "owner" | "manager",
        action: "payment_updated",
        entity_type: "payment",
        entity_id: id,
        description: `Updated payment ${id}`,
        metadata: { updates: Object.keys(updates) },
      });
    }
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
      .select("id, apartmentowner_id, unit_id, amount, payment_date")
      .eq("id", id)
      .single();

    if (paymentError || !payment) {
      sendError(res, "Payment not found", 404);
      return;
    }

    const updateData: any = { verification_status };

    // Manager verifies payment â€” keep status as pending, owner will approve later
    if (verification_status === "verified") {
      // Don't set status to paid â€” owner approval is required
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

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("phone")
      .eq("id", data.tenant_id)
      .maybeSingle();

    if (verification_status === "verified") {
      // Notify tenant
      await sendSmsToMany(
        [tenant?.phone],
        `[E-AMS] Your payment has been verified by the manager. Awaiting owner approval.`,
        { unit_id: data.unit_id, apartmentowner_id: data.apartmentowner_id }
      );

      if (data.apartmentowner_id && data.tenant_id) {
        await createNotification({
          apartmentowner_id: data.apartmentowner_id,
          unit_id: data.unit_id,
          recipient_role: "tenant",
          recipient_id: data.tenant_id,
          type: "payment_verification_updated",
          title: "Payment Verified",
          message: `Your payment has been verified by the manager. Awaiting owner approval.`,
        });
      }
    } else {
      await sendSmsToMany(
        [tenant?.phone],
        `[E-AMS] Your payment has been ${verification_status}.`,
        { unit_id: data.unit_id, apartmentowner_id: data.apartmentowner_id }
      );

      if (data.apartmentowner_id && data.tenant_id) {
        await createNotification({
          apartmentowner_id: data.apartmentowner_id,
          unit_id: data.unit_id,
          recipient_role: "tenant",
          recipient_id: data.tenant_id,
          type: "payment_verification_updated",
          title: "Payment Verification Update",
          message: `Your payment has been ${verification_status}.`,
        });
      }
    }

    sendSuccess(res, data, `Payment ${verification_status} successfully`);

    const actorName = req.user?.id
      ? await resolveActorName(req.user.id, req.user.role, req.user.email)
      : "System";
    logActivity({
      apartmentowner_id: data.apartmentowner_id,
      actor_id: req.user?.id || null,
      actor_name: actorName,
      actor_role: (req.user?.role as "owner" | "manager") || "manager",
      action: `payment_${verification_status}`,
      entity_type: "payment",
      entity_id: id,
      description: `Payment ${verification_status} â€” Amount: ${data.amount}`,
      metadata: { verification_status, amount: data.amount },
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * PUT /api/payments/:id/approve
 * Owner approves a manager-verified payment â€” marks it as paid and creates revenue.
 */
export async function approvePayment(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { id } = req.params;
    const { action } = req.body; // "approved" or "rejected"

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id, apartmentowner_id, unit_id, tenant_id, amount, payment_date, verification_status")
      .eq("id", id)
      .single();

    if (paymentError || !payment) {
      sendError(res, "Payment not found", 404);
      return;
    }

    if (payment.verification_status !== "verified") {
      sendError(res, "Only manager-verified payments can be approved", 400);
      return;
    }

    if (action === "approved") {
      const { data, error } = await supabaseAdmin
        .from("payments")
        .update({
          status: "paid",
          verification_status: "approved",
          payment_date: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        sendError(res, error.message, 500);
        return;
      }

      // Create revenue entry
      const revenueDescription = `Approved payment: ${id}`;
      const { data: existingRevenue } = await supabaseAdmin
        .from("revenues")
        .select("id")
        .eq("apartmentowner_id", payment.apartmentowner_id)
        .eq("description", revenueDescription)
        .maybeSingle();

      if (!existingRevenue) {
        await supabaseAdmin.from("revenues").insert({
          unit_id: payment.unit_id,
          apartmentowner_id: payment.apartmentowner_id,
          amount: payment.amount,
          month: payment.payment_date || new Date().toISOString(),
          description: revenueDescription,
        });
      }

      // Notify tenant
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("phone")
        .eq("id", data.tenant_id)
        .maybeSingle();

      await sendSmsToMany(
        [tenant?.phone],
        `[E-AMS] Your payment has been approved by the owner. Thank you!`,
        { unit_id: data.unit_id, apartmentowner_id: data.apartmentowner_id }
      );

      if (data.apartmentowner_id && data.tenant_id) {
        await createNotification({
          apartmentowner_id: data.apartmentowner_id,
          unit_id: data.unit_id,
          recipient_role: "tenant",
          recipient_id: data.tenant_id,
          type: "payment_verification_updated",
          title: "Payment Approved",
          message: `Your payment of â‚±${data.amount} has been approved.`,
        });
      }

      sendSuccess(res, data, "Payment approved successfully");

      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: data.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: "owner",
        action: "payment_approved",
        entity_type: "payment",
        entity_id: id,
        description: `Payment approved â€” Amount: â‚±${data.amount}`,
        metadata: { amount: data.amount },
      });
    } else if (action === "rejected") {
      const { data, error } = await supabaseAdmin
        .from("payments")
        .update({
          verification_status: "rejected",
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        sendError(res, error.message, 500);
        return;
      }

      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("phone")
        .eq("id", data.tenant_id)
        .maybeSingle();

      await sendSmsToMany(
        [tenant?.phone],
        `[E-AMS] Your payment has been rejected by the owner.`,
        { unit_id: data.unit_id, apartmentowner_id: data.apartmentowner_id }
      );

      if (data.apartmentowner_id && data.tenant_id) {
        await createNotification({
          apartmentowner_id: data.apartmentowner_id,
          unit_id: data.unit_id,
          recipient_role: "tenant",
          recipient_id: data.tenant_id,
          type: "payment_verification_updated",
          title: "Payment Rejected",
          message: `Your payment has been rejected by the owner.`,
        });
      }

      sendSuccess(res, data, "Payment rejected");

      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: data.apartmentowner_id,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: "owner",
        action: "payment_rejected",
        entity_type: "payment",
        entity_id: id,
        description: `Payment rejected â€” Amount: â‚±${data.amount}`,
        metadata: { amount: data.amount },
      });
    } else {
      sendError(res, "Invalid action. Use 'approved' or 'rejected'", 400);
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/payments/verified-pending-approval
 * Get payments that have been verified by manager but not yet approved by owner.
 */
export async function getVerifiedPayments(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const apartmentownerId = req.query.apartmentowner_id as string;

    if (!apartmentownerId) {
      sendError(res, "apartmentowner_id query parameter is required", 400);
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("payments")
      .select("*, tenants:tenant_id(first_name, last_name), apartments:unit_id(name)")
      .eq("apartmentowner_id", apartmentownerId)
      .eq("verification_status", "verified")
      .neq("status", "paid")
      .order("created_at", { ascending: false });

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    const results = (data || []).map((p: any) => ({
      ...p,
      tenant_name: p.tenants ? `${p.tenants.first_name} ${p.tenants.last_name}`.trim() || null : null,
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
 * POST /api/payments/generate-monthly
 * Generate pending billings for the current month.
 * Supports both apartmentowner_id (all owner units) and manager_id (scoped to manager's branch).
 */
export async function generateMonthlyBillings(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { apartmentowner_id, manager_id } = req.body;

    if (!apartmentowner_id && !manager_id) {
      sendError(res, "apartmentowner_id or manager_id is required", 400);
      return;
    }

    let apartments: any[] = [];

    if (manager_id) {
      // Scope to manager's assigned apartments
      const { unitIds } = await getManagerScope(manager_id);
      if (unitIds.length === 0) {
        sendSuccess(res, { created: 0 }, "No units found for this manager");
        return;
      }
      const { data } = await supabaseAdmin
        .from("units")
        .select("id, payment_due_day, monthly_rent, apartmentowner_id")
        .in("id", unitIds)
        .eq("status", "active");
      apartments = data || [];
    } else {
      // 1. Get all apartments for this owner
      const { data } = await supabaseAdmin
        .from("units")
        .select("id, payment_due_day, monthly_rent")
        .eq("apartmentowner_id", apartmentowner_id)
        .eq("status", "active");
      apartments = data || [];
    }

    if (!apartments || apartments.length === 0) {
      sendSuccess(res, { created: 0 }, "No apartments found");
      return;
    }

    const apartmentIds = apartments.map((a: any) => a.id);
    const apartmentMap = new Map(apartments.map((a: any) => [a.id, a]));

    // 2. Get all active tenants
    const { data: allTenants } = await supabaseAdmin
      .from("tenants")
      .select("id, unit_id")
      .in("unit_id", apartmentIds)
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
    let existingPaymentsQuery = supabaseAdmin
      .from("payments")
      .select("tenant_id, status")
      .gte("period_from", monthStart)
      .lte("period_from", monthEnd);

    if (manager_id) {
      existingPaymentsQuery = existingPaymentsQuery.in("unit_id", apartmentIds);
    } else {
      existingPaymentsQuery = existingPaymentsQuery.eq("apartmentowner_id", apartmentowner_id);
    }

    const { data: existingPayments } = await existingPaymentsQuery;

    const paidOrPendingTenants = new Set(
      (existingPayments || []).map((p: any) => p.tenant_id).filter(Boolean)
    );

    // 4. Create pending payments for tenants without a payment this month
    const newPayments: any[] = [];

    for (const tenant of allTenants) {
      if (paidOrPendingTenants.has(tenant.id)) continue;

      const apt = apartmentMap.get(tenant.unit_id);
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
        apartmentowner_id: apartmentowner_id || apt.apartmentowner_id,
        tenant_id: tenant.id,
        unit_id: tenant.unit_id,
        apartment_id: apt.id || await resolveApartmentId(tenant.unit_id),
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

    // 5. Mark existing pending payments as overdue if past due date (batched single query)
    const overdueUnitIds = apartments
      .filter((apt: any) => {
        if (!apt.payment_due_day) return false;
        const dueDay = Math.min(
          apt.payment_due_day,
          new Date(year, month + 1, 0).getDate()
        );
        return now > new Date(year, month, dueDay);
      })
      .map((apt: any) => apt.id);

    if (overdueUnitIds.length > 0) {
      let overdueQuery = supabaseAdmin
        .from("payments")
        .update({ status: "overdue" })
        .in("unit_id", overdueUnitIds)
        .eq("status", "pending")
        .gte("period_from", monthStart)
        .lte("period_from", monthEnd);

      if (!manager_id && apartmentowner_id) {
        overdueQuery = overdueQuery.eq("apartmentowner_id", apartmentowner_id);
      }

      await overdueQuery;
    }

    sendSuccess(
      res,
      { created: newPayments.length },
      `${newPayments.length} billing records created`
    );

    if (newPayments.length > 0) {
      const actorName = req.user?.id
        ? await resolveActorName(req.user.id, req.user.role, req.user.email)
        : "System";
      logActivity({
        apartmentowner_id: apartmentowner_id || (apartments[0] as any)?.apartmentowner_id || null,
        actor_id: req.user?.id || null,
        actor_name: actorName,
        actor_role: (req.user?.role as "owner" | "manager") || "owner",
        action: "monthly_billings_generated",
        entity_type: "payment",
        entity_id: null,
        description: `Generated ${newPayments.length} monthly billing records`,
        metadata: { count: newPayments.length, month: monthStart },
      });
    }
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/payments/pending-verifications
 * Get cash payments pending verification for an owner
 */
export async function getPendingVerifications(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const apartmentownerId = req.query.apartmentowner_id as string;
    const managerId = req.query.manager_id as string;

    if (!apartmentownerId && !managerId) {
      sendError(res, "apartmentowner_id or manager_id query parameter is required", 400);
      return;
    }

    let query = supabaseAdmin
      .from("payments")
      .select("*, tenants:tenant_id(first_name, last_name), apartments:unit_id(name)")
      .eq("verification_status", "pending_verification")
      .order("created_at", { ascending: false });

    if (managerId) {
      const { unitIds } = await getManagerScope(managerId);
      if (unitIds.length === 0) {
        sendSuccess(res, []);
        return;
      }
      query = query.in("unit_id", unitIds);
    } else {
      query = query.eq("apartmentowner_id", apartmentownerId);
    }

    const { data, error } = await query;

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    const results = (data || []).map((p: any) => ({
      ...p,
      tenant_name: p.tenants ? `${p.tenants.first_name} ${p.tenants.last_name}`.trim() || null : null,
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
    const { apartmentowner_id, data_url } = req.body as {
      apartmentowner_id?: string;
      data_url?: string;
    };

    if (!apartmentowner_id || !data_url) {
      sendError(res, "apartmentowner_id and data_url are required", 400);
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

    const objectPath = `${apartmentowner_id}/payment-qr`;
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
      { apartmentowner_id, path: objectPath, qr_url: signedData.signedUrl },
      "Payment QR uploaded successfully"
    );

    const actorName = req.user?.id
      ? await resolveActorName(req.user.id, req.user.role, req.user.email)
      : "System";
    logActivity({
      apartmentowner_id,
      actor_id: req.user?.id || null,
      actor_name: actorName,
      actor_role: (req.user?.role as "owner" | "manager") || "owner",
      action: "payment_qr_uploaded",
      entity_type: "payment_qr",
      entity_id: apartmentowner_id,
      description: "Uploaded payment QR code",
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/payments/qr/:apartmentownerId
 * Get signed URL for owner's payment QR image
 */
export async function getPaymentQr(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { apartmentownerId } = req.params;
    if (!apartmentownerId) {
      sendError(res, "apartmentownerId is required", 400);
      return;
    }

    await ensurePaymentQrBucket();
    const objectPath = `${apartmentownerId}/payment-qr`;

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(PAYMENT_QR_BUCKET)
      .createSignedUrl(objectPath, 60 * 60);

    if (signedError) {
      sendError(res, "QR code not found", 404);
      return;
    }

    sendSuccess(res, { apartmentowner_id: apartmentownerId, qr_url: signedData.signedUrl });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/payments/qr/by-apartment/:apartmentId
 * Resolve apartment -> apartmentowner_id then return signed QR URL
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
      .from("units")
      .select("apartmentowner_id")
      .eq("id", apartmentId)
      .single();

    if (apartmentError || !apartment?.apartmentowner_id) {
      sendError(res, "Owner not found for this apartment", 404);
      return;
    }

    await ensurePaymentQrBucket();
    const objectPath = `${apartment.apartmentowner_id}/payment-qr`;

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(PAYMENT_QR_BUCKET)
      .createSignedUrl(objectPath, 60 * 60);

    if (signedError) {
      sendError(res, "QR code not found", 404);
      return;
    }

    sendSuccess(res, { apartmentowner_id: apartment.apartmentowner_id, qr_url: signedData.signedUrl });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * GET /api/payments/qr/by-tenant/:tenantId
 * Resolve tenant -> apartment -> apartmentowner_id then return signed QR URL
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
      .select("id, unit_id, apartmentowner_id")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      sendError(res, "Tenant not found", 404);
      return;
    }

    let resolvedapartmentownerId: string | null = tenant.apartmentowner_id || null;

    if (!resolvedapartmentownerId && tenant.unit_id) {
      const { data: apartment } = await supabaseAdmin
        .from("units")
        .select("apartmentowner_id")
        .eq("id", tenant.unit_id)
        .single();
      resolvedapartmentownerId = apartment?.apartmentowner_id || null;
    }

    if (!resolvedapartmentownerId) {
      sendError(res, "Owner not found for this tenant", 404);
      return;
    }

    // Fetch owner payment_info in parallel with QR
    const [ownerResult, qrResult] = await Promise.all([
      supabaseAdmin
        .from("apartment_owners")
        .select("payment_info")
        .eq("id", resolvedapartmentownerId)
        .maybeSingle(),
      (async () => {
        await ensurePaymentQrBucket();
        const objectPath = `${resolvedapartmentownerId}/payment-qr`;
        return supabaseAdmin.storage
          .from(PAYMENT_QR_BUCKET)
          .createSignedUrl(objectPath, 60 * 60);
      })(),
    ]);

    const paymentInfo = ownerResult.data?.payment_info || {};
    const qrUrl = qrResult.data?.signedUrl || null;

    if (!qrUrl && (!paymentInfo || Object.keys(paymentInfo).length === 0)) {
      sendError(res, "No payment info found", 404);
      return;
    }

    sendSuccess(res, {
      tenant_id: tenantId,
      apartmentowner_id: resolvedapartmentownerId,
      qr_url: qrUrl,
      payment_info: paymentInfo,
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}

/**
 * DELETE /api/payments/qr/:apartmentownerId
 * Remove owner's payment QR image from Supabase Storage
 */
export async function deletePaymentQr(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const { apartmentownerId } = req.params;
    if (!apartmentownerId) {
      sendError(res, "apartmentownerId is required", 400);
      return;
    }

    await ensurePaymentQrBucket();
    const objectPath = `${apartmentownerId}/payment-qr`;
    const { error } = await supabaseAdmin.storage
      .from(PAYMENT_QR_BUCKET)
      .remove([objectPath]);

    if (error) {
      sendError(res, error.message, 500);
      return;
    }

    sendSuccess(res, { apartmentowner_id: apartmentownerId }, "Payment QR removed successfully");

    const actorName = req.user?.id
      ? await resolveActorName(req.user.id, req.user.role, req.user.email)
      : "System";
    logActivity({
      apartmentowner_id: String(apartmentownerId),
      actor_id: req.user?.id || null,
      actor_name: actorName,
      actor_role: (req.user?.role as "owner" | "manager") || "owner",
      action: "payment_qr_deleted",
      entity_type: "payment_qr",
      entity_id: String(apartmentownerId),
      description: "Removed payment QR code",
    });
  } catch (err: any) {
    sendError(res, err.message, 500);
  }
}
