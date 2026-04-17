import { supabaseAdmin } from "../config/supabase";
import { createNotification } from "./notifications";
import { sendSmsSemaphore } from "./sms";

const REMINDER_DAYS_BEFORE = 3;
const GRACE_DAYS = 3;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // every hour

function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Check if a notification of given type already exists for this tenant + billing period */
async function notificationAlreadySent(
  tenantId: string,
  type: string,
  periodFrom: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("recipient_id", tenantId)
    .eq("type", type)
    .ilike("message", `%${periodFrom}%`)
    .limit(1);
  return (data && data.length > 0) || false;
}

async function sendReminderSms(phone: string, tenantName: string, amount: number, dueDate: string): Promise<void> {
  const msg = `Hi ${tenantName}, your rent of P${amount.toLocaleString()} is due on ${dueDate}. Please settle your payment on time. - E-AMS`;
  try {
    await sendSmsSemaphore(phone, msg);
  } catch (err) {
    console.error("[BillingScheduler] Reminder SMS failed:", err);
  }
}

async function sendOverdueSms(phone: string, tenantName: string, amount: number, dueDate: string): Promise<void> {
  const msg = `Hi ${tenantName}, your rent of P${amount.toLocaleString()} due on ${dueDate} is now overdue. Please settle immediately. - E-AMS`;
  try {
    await sendSmsSemaphore(phone, msg);
  } catch (err) {
    console.error("[BillingScheduler] Overdue SMS failed:", err);
  }
}

export async function checkBillingNotifications(): Promise<void> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reminderDate = new Date(today);
    reminderDate.setDate(reminderDate.getDate() + REMINDER_DAYS_BEFORE);

    const todayStr = toLocalDateString(today);
    const reminderStr = toLocalDateString(reminderDate);

    // ── 1. Payment Reminders (due within next 3 days) ──────────────
    const { data: upcomingPayments } = await supabaseAdmin
      .from("payments")
      .select("id, tenant_id, amount, period_from, status, description")
      .eq("status", "pending")
      .gte("period_from", todayStr)
      .lte("period_from", reminderStr);

    for (const payment of upcomingPayments || []) {
      if (!payment.tenant_id) continue;

      const alreadySent = await notificationAlreadySent(
        payment.tenant_id,
        "payment_reminder",
        payment.period_from
      );
      if (alreadySent) continue;

      // Get tenant info
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("first_name, last_name, phone, apartmentowner_id, unit_id")
        .eq("id", payment.tenant_id)
        .single();

      if (!tenant) continue;

      const tenantName = `${tenant.first_name} ${tenant.last_name}`.trim();

      // Create in-app notification
      await createNotification({
        apartmentowner_id: tenant.apartmentowner_id || "",
        recipient_role: "tenant",
        recipient_id: payment.tenant_id,
        type: "payment_reminder",
        title: "Payment Reminder",
        message: `Your rent of ₱${payment.amount.toLocaleString()} is due on ${payment.period_from}. Please settle your payment on time.`,
        unit_id: tenant.unit_id,
      });

      // Send SMS
      if (tenant.phone) {
        await sendReminderSms(tenant.phone, tenantName, payment.amount, payment.period_from);
      }

      console.log(`[BillingScheduler] Reminder sent to ${tenantName} for ${payment.period_from}`);
    }

    // ── 2. Overdue Notices (past due + grace period) ────────────────
    const graceCutoff = new Date(today);
    graceCutoff.setDate(graceCutoff.getDate() - GRACE_DAYS);
    const graceCutoffStr = toLocalDateString(graceCutoff);

    const { data: overduePayments } = await supabaseAdmin
      .from("payments")
      .select("id, tenant_id, amount, period_from, status, description")
      .eq("status", "pending")
      .lte("period_from", graceCutoffStr);

    for (const payment of overduePayments || []) {
      if (!payment.tenant_id) continue;

      // Mark as overdue
      await supabaseAdmin
        .from("payments")
        .update({ status: "overdue" })
        .eq("id", payment.id);

      const alreadySent = await notificationAlreadySent(
        payment.tenant_id,
        "payment_overdue",
        payment.period_from
      );
      if (alreadySent) continue;

      // Get tenant info
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("first_name, last_name, phone, apartmentowner_id, unit_id")
        .eq("id", payment.tenant_id)
        .single();

      if (!tenant) continue;

      const tenantName = `${tenant.first_name} ${tenant.last_name}`.trim();

      // Notify tenant
      await createNotification({
        apartmentowner_id: tenant.apartmentowner_id || "",
        recipient_role: "tenant",
        recipient_id: payment.tenant_id,
        type: "payment_overdue",
        title: "Payment Overdue",
        message: `Your rent of ₱${payment.amount.toLocaleString()} due on ${payment.period_from} is now overdue. Please settle your balance immediately.`,
        unit_id: tenant.unit_id,
      });

      // Notify manager
      if (tenant.apartmentowner_id) {
        const { data: managers } = await supabaseAdmin
          .from("managers")
          .select("id")
          .eq("apartmentowner_id", tenant.apartmentowner_id)
          .eq("status", "active");

        for (const manager of managers || []) {
          await createNotification({
            apartmentowner_id: tenant.apartmentowner_id,
            recipient_role: "manager",
            recipient_id: manager.id,
            type: "payment_overdue",
            title: "Tenant Payment Overdue",
            message: `${tenantName}'s rent of ₱${payment.amount.toLocaleString()} due on ${payment.period_from} is now overdue.`,
            unit_id: tenant.unit_id,
          });
        }
      }

      // Send SMS to tenant
      if (tenant.phone) {
        await sendOverdueSms(tenant.phone, tenantName, payment.amount, payment.period_from);
      }

      console.log(`[BillingScheduler] Overdue notice sent to ${tenantName} for ${payment.period_from}`);
    }
  } catch (err) {
    console.error("[BillingScheduler] Error:", err);
  }
}

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startBillingScheduler(): void {
  console.log("[BillingScheduler] Started — checking every hour");

  // Run immediately on startup
  checkBillingNotifications().catch((err) =>
    console.error("[BillingScheduler] Initial check failed:", err)
  );

  // Then run hourly
  schedulerInterval = setInterval(() => {
    checkBillingNotifications().catch((err) =>
      console.error("[BillingScheduler] Scheduled check failed:", err)
    );
  }, CHECK_INTERVAL_MS);
}

export function stopBillingScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[BillingScheduler] Stopped");
  }
}
