import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  sendEmailOtp,
  verifyEmailOtp,
  getMfaPreference,
  setMfaPreference,
  removeMfaPreference,
} from "../controllers/emailOtp.controller";

const router = Router();

router.use(authenticate);

// Email OTP send + verify (all authenticated roles)
router.post("/email-otp/send", authorize("owner", "manager", "tenant"), sendEmailOtp);
router.post("/email-otp/verify", authorize("owner", "manager", "tenant"), verifyEmailOtp);

// MFA preference management
router.get("/preference", authorize("owner", "manager", "tenant"), getMfaPreference);
router.post("/preference", authorize("owner", "manager", "tenant"), setMfaPreference);
router.delete("/preference", authorize("owner", "manager", "tenant"), removeMfaPreference);

export default router;
