import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getInquiries,
  getInquiryById,
  createInquiry,
  updateInquiryStatus,
  getPendingInquiryCount,
} from "../controllers/inquiries.controller";

const router = Router();

// Public route -- landing page contact form
router.post("/", createInquiry);

// Protected routes
router.get("/count/pending", authenticate, authorize("admin"), getPendingInquiryCount);
router.get("/", authenticate, authorize("admin"), getInquiries);
router.get("/:id", authenticate, authorize("admin"), getInquiryById);
router.put("/:id/status", authenticate, authorize("admin"), updateInquiryStatus);

export default router;
