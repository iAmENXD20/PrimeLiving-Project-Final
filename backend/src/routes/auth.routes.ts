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
} from "../controllers/auth.controller";

const router = Router();

// Public routes
router.post("/login", login);
router.post("/reset-password", resetPassword);

// Protected routes
router.post("/logout", authenticate, logout);
router.put("/update-password", authenticate, updatePassword);
router.get("/me", authenticate, getMe);
router.get(
  "/validate-email",
  authenticate,
  authorize("admin", "owner", "manager"),
  validateEmailForAccountCreation
);

export default router;
