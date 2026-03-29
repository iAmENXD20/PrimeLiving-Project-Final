import { env } from "../config/env";
import { supabaseAdmin } from "../config/supabase";

interface SmsContext {
  apartment_id?: string | null;
  unit_id?: string | null;
  apartmentowner_id?: string | null;
}

async function resolveApartmentId(context?: SmsContext): Promise<string | null> {
  if (!context) return null;
  if (context.apartment_id) return context.apartment_id;

  if (context.unit_id) {
    const { data: unit } = await supabaseAdmin
      .from("units")
      .select("apartment_id")
      .eq("id", context.unit_id)
      .maybeSingle();

    if (unit?.apartment_id) return unit.apartment_id;
  }

  if (context.apartmentowner_id) {
    const { data: apartment } = await supabaseAdmin
      .from("apartments")
      .select("id")
      .eq("apartmentowner_id", context.apartmentowner_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (apartment?.id) return apartment.id;
  }

  return null;
}

async function logSmsAttempt(
  phone: string,
  message: string,
  status: "sent" | "failed",
  error?: string,
  context?: SmsContext
): Promise<void> {
  try {
    const apartmentId = await resolveApartmentId(context);

    await supabaseAdmin.from("sms_logs").insert({
      phone,
      message,
      status,
      error: error || null,
      apartment_id: apartmentId,
    });
  } catch (logError) {
    console.error("Failed to write sms_logs:", logError);
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("0") && digits.length === 11) return `63${digits.slice(1)}`;
  if (digits.startsWith("63") && digits.length === 12) return digits;
  if (digits.startsWith("9") && digits.length === 10) return `63${digits}`;
  if (digits.startsWith("639") && digits.length === 12) return digits;

  return digits;
}

export async function sendSmsSemaphore(phone: string, message: string): Promise<void> {
  const apiKey = env.SEMAPHORE_API_KEY;
  if (env.SMS_ENABLED === "false") return;
  if (!apiKey) {
    throw new Error("SEMAPHORE_API_KEY is not configured");
  }

  const normalizedPhone = normalizePhone(phone);
  if (!/^63\d{10}$/.test(normalizedPhone)) {
    throw new Error(`Invalid PH mobile number format: ${phone}`);
  }

  // Semaphore expects 09XX format (local PH), convert back from 63 prefix
  const localPhone = `0${normalizedPhone.slice(2)}`;

  // Truncate to 160 characters to conserve SMS credits (1 credit per 160 chars)
  const truncatedMessage = message.length > 160 ? message.slice(0, 157) + "..." : message;

  const payload: Record<string, string> = {
    apikey: apiKey,
    number: localPhone,
    message: truncatedMessage,
  };

  if (env.SEMAPHORE_SENDER_NAME) {
    payload.sendername = env.SEMAPHORE_SENDER_NAME;
  }

  const url = env.SEMAPHORE_API_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let responseBody: any = null;
  const text = await response.text();
  try {
    responseBody = text ? JSON.parse(text) : null;
  } catch {
    responseBody = text;
  }

  if (!response.ok) {
    const errorMsg =
      typeof responseBody === "string"
        ? responseBody
        : responseBody?.message || JSON.stringify(responseBody || {});
    throw new Error(`Semaphore SMS failed (${response.status}): ${errorMsg}`);
  }

  // Semaphore returns an array on success; check for error responses
  if (responseBody && typeof responseBody === "object" && !Array.isArray(responseBody) && responseBody.status === false) {
    throw new Error(`Semaphore SMS error: ${responseBody.message || "Unknown error"}`);
  }
}

export async function sendSmsToMany(
  phones: Array<string | null | undefined>,
  message: string,
  context?: SmsContext
): Promise<void> {
  const uniquePhones = Array.from(new Set(phones.filter(Boolean) as string[]));

  await Promise.allSettled(
    uniquePhones.map(async (phone) => {
      try {
        await sendSmsSemaphore(phone, message);
        await logSmsAttempt(phone, message, "sent", undefined, context);
      } catch (error) {
        console.error("SMS send failed:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logSmsAttempt(phone, message, "failed", errorMessage, context);
      }
    })
  );
}

export const sendSmsPhilSms = sendSmsSemaphore; // backward compat alias
