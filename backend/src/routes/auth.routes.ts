import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  login,
  logout,
  resetPassword,
  updatePassword,
  getMe,
  validateEmailForAccountCreation,
  checkSetup,
  setupOwner,
} from "../controllers/auth.controller";

const router = Router();

// Public routes
router.get("/check-setup", checkSetup);
router.post("/setup", setupOwner);
router.post("/login", login);
router.post("/reset-password", resetPassword);

// Protected routes
router.post("/logout", authenticate, logout);
router.put("/update-password", authenticate, updatePassword);
router.get("/me", authenticate, getMe);
router.get(
  "/validate-email",
  authenticate,
  authorize("owner", "manager"),
  validateEmailForAccountCreation
);

export default router;
