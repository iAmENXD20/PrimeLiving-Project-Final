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
  PHILSMS_API_KEY:
    process.env.PHILSMS_API_KEY ||
    process.env.PHILSMS_TOKEN ||
    process.env.SEMAPHORE_API_KEY ||
    process.env.SEMAPHORE_APIKEY ||
    process.env.SMS_API_KEY ||
    "",
  PHILSMS_SENDER_ID:
    process.env.PHILSMS_SENDER_ID ||
    process.env.PHILSMS_SENDER_NAME ||
    process.env.SEMAPHORE_SENDER_NAME ||
    "",
  PHILSMS_API_URL: process.env.PHILSMS_API_URL || "https://dashboard.philsms.com/api/v3/sms/send",
  SMS_ENABLED: process.env.SMS_ENABLED,
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

if (env.SMS_ENABLED !== "false" && !env.PHILSMS_API_KEY) {
  console.warn("SMS is enabled but PHILSMS_API_KEY is missing. SMS delivery will fail.");
}
