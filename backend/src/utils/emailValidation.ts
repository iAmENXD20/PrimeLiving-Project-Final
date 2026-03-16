import { promises as dns } from "dns";
import https from "https";
import { env } from "../config/env";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DNS_LOOKUP_TIMEOUT_MS = 4000;
const EMAIL_API_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("DNS lookup timeout"));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

export function isValidEmailFormat(email: string): boolean {
  return emailPattern.test(email);
}

export async function hasDeliverableEmailDomain(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.trim().toLowerCase();

  if (!domain) {
    return false;
  }

  try {
    const mxRecords = await withTimeout(dns.resolveMx(domain), DNS_LOOKUP_TIMEOUT_MS);
    if (mxRecords.length > 0) {
      return true;
    }
  } catch {
  }

  try {
    const [ipv4Records, ipv6Records] = await withTimeout(
      Promise.allSettled([dns.resolve4(domain), dns.resolve6(domain)]),
      DNS_LOOKUP_TIMEOUT_MS
    );

    const hasIpv4 =
      ipv4Records.status === "fulfilled" && Array.isArray(ipv4Records.value) && ipv4Records.value.length > 0;
    const hasIpv6 =
      ipv6Records.status === "fulfilled" && Array.isArray(ipv6Records.value) && ipv6Records.value.length > 0;

    return hasIpv4 || hasIpv6;
  } catch {
    return false;
  }
}

type MailboxApiResult = {
  deliverability?: string;
  is_smtp_valid?: { value?: boolean };
};

function getJson(url: string, timeoutMs: number): Promise<MailboxApiResult> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: timeoutMs }, (res) => {
      const chunks: Buffer[] = [];

      res.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      res.on("end", () => {
        try {
          const raw = Buffer.concat(chunks).toString("utf8");
          const parsed = JSON.parse(raw) as MailboxApiResult;
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on("error", reject);

    req.on("timeout", () => {
      req.destroy(new Error("Email verification API timeout"));
    });
  });
}

async function verifyMailboxWithApi(email: string): Promise<boolean | null> {
  if (!env.EMAIL_VERIFICATION_API_KEY) {
    return null;
  }

  try {
    const baseUrl = env.EMAIL_VERIFICATION_API_URL.replace(/\/+$/, "");
    const verificationUrl = `${baseUrl}/?api_key=${encodeURIComponent(env.EMAIL_VERIFICATION_API_KEY)}&email=${encodeURIComponent(email)}`;
    const response = await getJson(verificationUrl, EMAIL_API_TIMEOUT_MS);

    const deliverability = (response.deliverability || "").toUpperCase();
    if (deliverability === "DELIVERABLE") {
      return true;
    }

    if (deliverability === "UNDELIVERABLE") {
      return false;
    }

    if (typeof response.is_smtp_valid?.value === "boolean") {
      return response.is_smtp_valid.value;
    }

    return false;
  } catch {
    return null;
  }
}

export async function mailboxExists(email: string): Promise<boolean> {
  const apiResult = await verifyMailboxWithApi(email);

  if (apiResult === true) {
    return true;
  }

  if (apiResult === false) {
    return false;
  }

  return env.EMAIL_VERIFICATION_REQUIRED !== "true";
}
