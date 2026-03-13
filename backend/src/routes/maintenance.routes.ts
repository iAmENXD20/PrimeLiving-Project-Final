import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getMaintenanceRequests,
  getMaintenanceRequestById,
  createMaintenanceRequest,
  updateMaintenanceStatus,
  getPendingMaintenanceCount,
} from "../controllers/maintenance.controller";

const router = Router();

router.use(authenticate);

router.get("/count/pending", authorize("admin", "owner", "manager"), getPendingMaintenanceCount);
router.get("/", authorize("admin", "owner", "manager", "tenant"), getMaintenanceRequests);
router.get("/:id", authorize("admin", "owner", "manager", "tenant"), getMaintenanceRequestById);
router.post("/", authorize("admin", "owner", "manager", "tenant"), createMaintenanceRequest);
router.put("/:id/status", authorize("admin", "owner", "manager"), updateMaintenanceStatus);

export default router;
