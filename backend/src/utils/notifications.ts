import { supabaseAdmin } from "../config/supabase";

interface NotificationPayload {
  client_id: string;
  recipient_role: "manager" | "tenant";
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  apartment_id?: string | null;
  unit_id?: string | null;
}

async function resolveApartmentId(payload: NotificationPayload): Promise<string | null> {
  if (payload.apartment_id) return payload.apartment_id;

  if (payload.unit_id) {
    const { data: unit } = await supabaseAdmin
      .from("units")
      .select("apartment_id")
      .eq("id", payload.unit_id)
      .maybeSingle();

    if (unit?.apartment_id) return unit.apartment_id;
  }

  const { data: apartment } = await supabaseAdmin
    .from("apartments")
    .select("id")
    .eq("client_id", payload.client_id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return apartment?.id || null;
}

export async function createNotification(payload: NotificationPayload): Promise<void> {
  const apartmentId = await resolveApartmentId(payload);
  const { apartment_id: _ignoredApartmentId, unit_id: _ignoredUnitId, ...rest } = payload;

  await supabaseAdmin.from("notifications").insert({
    ...rest,
    apartment_id: apartmentId,
  });
}

export async function createNotifications(payloads: NotificationPayload[]): Promise<void> {
  if (!payloads.length) return;

  const rows = await Promise.all(
    payloads.map(async (payload) => {
      const apartmentId = await resolveApartmentId(payload);
      const { apartment_id: _ignoredApartmentId, unit_id: _ignoredUnitId, ...rest } = payload;
      return {
        ...rest,
        apartment_id: apartmentId,
      };
    })
  );

  await supabaseAdmin.from("notifications").insert(rows);
}
