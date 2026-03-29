import dotenv from "dotenv";
import path from "path";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "backend/.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const env = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  NODE_ENV: process.env.NODE_ENV || "development",
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  CACHE_ENABLED: process.env.CACHE_ENABLED || "true",
  CACHE_DEFAULT_TTL_SECONDS: parseInt(process.env.CACHE_DEFAULT_TTL_SECONDS || "30", 10),
  SEMAPHORE_API_KEY:
    process.env.SEMAPHORE_API_KEY ||
    process.env.SEMAPHORE_APIKEY ||
    process.env.SMS_API_KEY ||
    "",
  SEMAPHORE_SENDER_NAME:
    process.env.SEMAPHORE_SENDER_NAME ||
    "",
  SEMAPHORE_API_URL: process.env.SEMAPHORE_API_URL || "https://api.semaphore.co/api/v4/messages",
  SMS_ENABLED: process.env.SMS_ENABLED,
  EMAIL_VERIFICATION_API_KEY: process.env.EMAIL_VERIFICATION_API_KEY || "",
  EMAIL_VERIFICATION_API_URL:
    process.env.EMAIL_VERIFICATION_API_URL || "https://emailvalidation.abstractapi.com/v1/",
  EMAIL_VERIFICATION_REQUIRED: process.env.EMAIL_VERIFICATION_REQUIRED || "false",
};

// Validate required env vars
const requiredVars = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

for (const varName of requiredVars) {
  if (!env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
}

if (env.SMS_ENABLED !== "false" && !env.SEMAPHORE_API_KEY) {
  console.warn("SMS is enabled but SEMAPHORE_API_KEY is missing. SMS delivery will fail.");
}

if (env.EMAIL_VERIFICATION_REQUIRED === "true" && !env.EMAIL_VERIFICATION_API_KEY) {
  console.warn(
    "EMAIL_VERIFICATION_REQUIRED is true but EMAIL_VERIFICATION_API_KEY is missing. Mailbox verification will fail."
  );
}
