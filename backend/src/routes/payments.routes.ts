import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
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

router.get("/due-schedule/:tenantId", authorize("admin", "owner", "manager", "tenant"), getTenantDueSchedule);
router.get("/qr/by-tenant/:tenantId", authorize("admin", "owner", "manager", "tenant"), getPaymentQrByTenant);
router.get("/qr/by-apartment/:apartmentId", authorize("admin", "owner", "manager", "tenant"), getPaymentQrByApartment);
router.get("/qr/:clientId", authorize("admin", "owner", "manager", "tenant"), getPaymentQr);
router.post("/qr", authorize("owner", "manager"), uploadPaymentQr);
router.delete("/qr/:clientId", authorize("owner", "manager"), deletePaymentQr);
router.get("/pending-verifications", authorize("owner", "manager"), getPendingVerifications);
router.get("/", authorize("admin", "owner", "manager", "tenant"), getPayments);
router.get("/:id", authorize("admin", "owner", "manager", "tenant"), getPaymentById);
router.post("/generate-monthly", authorize("owner", "manager"), generateMonthlyBillings);
router.post("/bulk", authorize("owner", "manager"), createPaymentsBulk);
router.post("/submit-proof", authorize("tenant"), submitPaymentProof);
router.post("/", authorize("admin", "owner", "manager", "tenant"), createPayment);
router.put("/:id/verify", authorize("owner", "manager"), verifyPayment);
router.put("/:id", authorize("admin", "owner", "manager", "tenant"), updatePayment);

export default router;
