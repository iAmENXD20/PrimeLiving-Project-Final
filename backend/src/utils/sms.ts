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

  if (digits.startsWith("0") && digits.length === 11) return digits;
  if (digits.startsWith("63") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.length === 10) return `0${digits}`;

  return digits;
}

export async function sendSmsSemaphore(phone: string, message: string): Promise<void> {
  const apiKey = env.SEMAPHORE_API_KEY;
  if (env.SMS_ENABLED === "false") return;
  if (!apiKey) {
    throw new Error("SEMAPHORE_API_KEY is not configured");
  }

  const normalizedPhone = normalizePhone(phone);

  const params: Record<string, string> = {
    apikey: apiKey,
    number: normalizedPhone,
    message,
  };

  if (env.SEMAPHORE_SENDER_NAME) {
    params.sendername = env.SEMAPHORE_SENDER_NAME;
  }

  const body = new URLSearchParams(params);

  const response = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Semaphore SMS failed (${response.status}): ${text}`);
  }
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
