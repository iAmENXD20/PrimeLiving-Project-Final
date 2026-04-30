import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// Import routes
import authRoutes from "./routes/auth.routes";
import ownersRoutes from "./routes/owners.routes";
import managersRoutes from "./routes/managers.routes";
import apartmentsRoutes from "./routes/apartments.routes";
import tenantsRoutes from "./routes/tenants.routes";
import maintenanceRoutes from "./routes/maintenance.routes";
import paymentsRoutes from "./routes/payments.routes";
import documentsRoutes from "./routes/documents.routes";
import announcementsRoutes from "./routes/announcements.routes";
import notificationsRoutes from "./routes/notifications.routes";
import analyticsRoutes from "./routes/analytics.routes";
import revenuesRoutes from "./routes/revenues.routes";
import apartmentLogsRoutes from "./routes/apartment-logs.routes";
import expensesRoutes from "./routes/expenses.routes";
import emailOtpRoutes from "./routes/emailOtp.routes";

const app = express();

// ── Global Middleware ──
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ──
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "E-AMS API is running",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ──
app.use("/api/auth", authRoutes);
app.use("/api/owners", ownersRoutes);
app.use("/api/managers", managersRoutes);
app.use("/api/apartments", apartmentsRoutes);
app.use("/api/tenants", tenantsRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/documents", documentsRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/revenues", revenuesRoutes);
app.use("/api/apartment-logs", apartmentLogsRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/auth/mfa", emailOtpRoutes);

// ── Error Handling ──
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
