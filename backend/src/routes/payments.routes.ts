import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getPayments,
  getPaymentById,
  createPayment,
  createPaymentsBulk,
  updatePayment,
  verifyPayment,
  generateMonthlyBillings,
  getPendingVerifications,
} from "../controllers/payments.controller";

const router = Router();

router.use(authenticate);

router.get("/pending-verifications", authorize("owner", "manager"), getPendingVerifications);
router.get("/", authorize("admin", "owner", "manager", "tenant"), getPayments);
router.get("/:id", authorize("admin", "owner", "manager", "tenant"), getPaymentById);
router.post("/generate-monthly", authorize("owner", "manager"), generateMonthlyBillings);
router.post("/bulk", authorize("owner", "manager"), createPaymentsBulk);
router.post("/", authorize("admin", "owner", "manager", "tenant"), createPayment);
router.put("/:id/verify", authorize("owner", "manager"), verifyPayment);
router.put("/:id", authorize("admin", "owner", "manager", "tenant"), updatePayment);

export default router;
