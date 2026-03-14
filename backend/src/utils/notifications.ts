import { supabaseAdmin } from "../config/supabase";

interface NotificationPayload {
  client_id: string;
  recipient_role: "manager" | "tenant";
  recipient_id: string;
  type: string;
  title: string;
  message: string;
}

export async function createNotification(payload: NotificationPayload): Promise<void> {
  await supabaseAdmin.from("notifications").insert(payload);
}

export async function createNotifications(payloads: NotificationPayload[]): Promise<void> {
  if (!payloads.length) return;
  await supabaseAdmin.from("notifications").insert(payloads);
}
