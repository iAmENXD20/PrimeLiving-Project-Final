import { env } from "../config/env";
import { supabaseAdmin } from "../config/supabase";

async function logSmsAttempt(phone: string, message: string, status: "sent" | "failed", error?: string): Promise<void> {
  try {
    await supabaseAdmin.from("sms_logs").insert({
      phone,
      message,
      status,
      error: error || null,
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
  const apiKey = env.PHILSMS_API_KEY;
  if (env.SMS_ENABLED === "false") return;
  if (!apiKey) {
    throw new Error("PHILSMS_API_KEY is not configured");
  }

  const normalizedPhone = normalizePhone(phone);
  if (!/^63\d{10}$/.test(normalizedPhone)) {
    throw new Error(`Invalid PH mobile number format: ${phone}`);
  }
  if (!env.PHILSMS_SENDER_ID) {
    throw new Error("PHILSMS_SENDER_ID is not configured. Set an authorized sender ID in backend/.env.");
  }

  const payload: Record<string, string> = {
    recipient: normalizedPhone,
    message,
    type: "plain",
  };

  payload.sender_id = env.PHILSMS_SENDER_ID;

  const alternateUrl = env.PHILSMS_API_URL.includes("dashboard.philsms.com")
    ? "https://app.philsms.com/api/v3/sms/send"
    : "https://dashboard.philsms.com/api/v3/sms/send";

  const keyCandidates = Array.from(new Set([apiKey, apiKey.split("|")[1]].filter(Boolean) as string[]));
  const urlCandidates = Array.from(new Set([env.PHILSMS_API_URL, alternateUrl]));

  let lastError = "PhilSMS send failed";

  for (const url of urlCandidates) {
    for (const key of keyCandidates) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
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

      const providerMessage =
        typeof responseBody === "string"
          ? responseBody
          : responseBody?.message || JSON.stringify(responseBody || {});

      if (!response.ok) {
        lastError = `PhilSMS failed (${response.status}): ${providerMessage}`;
        const isAuthError = /unauthenticated/i.test(providerMessage);
        if (isAuthError) continue;
        throw new Error(lastError);
      }

      if (responseBody && typeof responseBody === "object" && responseBody.status === "error") {
        lastError = `PhilSMS error: ${responseBody.message || "Unknown provider error"}`;
        const isAuthError = /unauthenticated/i.test(responseBody.message || "");
        if (isAuthError) continue;
        throw new Error(lastError);
      }

      return;
    }
  }

  throw new Error(lastError);
}

export async function sendSmsToMany(phones: Array<string | null | undefined>, message: string): Promise<void> {
  const uniquePhones = Array.from(new Set(phones.filter(Boolean) as string[]));

  await Promise.allSettled(
    uniquePhones.map(async (phone) => {
      try {
        await sendSmsSemaphore(phone, message);
        await logSmsAttempt(phone, message, "sent");
      } catch (error) {
        console.error("SMS send failed:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        await logSmsAttempt(phone, message, "failed", errorMessage);
      }
    })
  );
}

export const sendSmsPhilSms = sendSmsSemaphore;
