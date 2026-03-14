import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { cacheResponse, invalidateCache } from "../middleware/cache.middleware";
import {
  getPayments,
  getTenantDueSchedule,
  getPaymentById,
  createPayment,
  submitPaymentProof,
  createPaymentsBulk,
  updatePayment,
  verifyPayment,
  generateMonthlyBillings,
  getPendingVerifications,
  uploadPaymentQr,
  getPaymentQr,
  getPaymentQrByApartment,
  getPaymentQrByTenant,
  deletePaymentQr,
} from "../controllers/payments.controller";

const router = Router();

router.use(authenticate);

router.get("/due-schedule/:tenantId", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "payments", ttlSeconds: 20 }), getTenantDueSchedule);
router.get("/qr/by-tenant/:tenantId", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "payments", ttlSeconds: 30 }), getPaymentQrByTenant);
router.get("/qr/by-apartment/:apartmentId", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "payments", ttlSeconds: 30 }), getPaymentQrByApartment);
router.get("/qr/:clientId", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "payments", ttlSeconds: 30 }), getPaymentQr);
router.post("/qr", authorize("owner", "manager"), uploadPaymentQr);
router.delete("/qr/:clientId", authorize("owner", "manager"), deletePaymentQr);
router.get("/pending-verifications", authorize("owner", "manager"), cacheResponse({ namespace: "payments", ttlSeconds: 10 }), getPendingVerifications);
router.get("/", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "payments", ttlSeconds: 15 }), getPayments);
router.get("/:id", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "payments", ttlSeconds: 15 }), getPaymentById);
router.post("/generate-monthly", authorize("owner", "manager"), invalidateCache(["payments", "analytics"]), generateMonthlyBillings);
router.post("/bulk", authorize("owner", "manager"), invalidateCache(["payments", "analytics"]), createPaymentsBulk);
router.post("/submit-proof", authorize("tenant"), invalidateCache(["payments", "notifications", "analytics"]), submitPaymentProof);
router.post("/", authorize("admin", "owner", "manager", "tenant"), invalidateCache(["payments", "analytics"]), createPayment);
router.put("/:id/verify", authorize("owner", "manager"), invalidateCache(["payments", "analytics", "notifications"]), verifyPayment);
router.put("/:id", authorize("admin", "owner", "manager", "tenant"), invalidateCache(["payments", "analytics"]), updatePayment);

export default router;
