import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getApartmentLogs,
  createApartmentLog,
  deleteApartmentLog,
  clearApartmentLogs,
} from "../controllers/apartment-logs.controller";

const router = Router();

router.use(authenticate);

// Read logs — owners, managers can view
router.get("/", authorize("admin", "owner", "manager"), getApartmentLogs);

// Create a log entry — owners, managers, system
router.post("/", authorize("admin", "owner", "manager"), createApartmentLog);

// Delete a single log entry — owners only
router.delete("/:id", authorize("admin", "owner"), deleteApartmentLog);

// Clear all logs for an owner — owners only
router.delete("/", authorize("admin", "owner"), clearApartmentLogs);

export default router;
