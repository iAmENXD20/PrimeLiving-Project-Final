import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { cacheResponse, invalidateCache } from "../middleware/cache.middleware";
import {
  getMaintenanceRequests,
  getMaintenanceRequestById,
  createMaintenanceRequest,
  updateMaintenanceStatus,
  getPendingMaintenanceCount,
  uploadMaintenancePhoto,
} from "../controllers/maintenance.controller";

const router = Router();

router.use(authenticate);

router.get("/count/pending", authorize("admin", "owner", "manager"), cacheResponse({ namespace: "maintenance", ttlSeconds: 15 }), getPendingMaintenanceCount);
router.post("/photos", authorize("admin", "owner", "manager", "tenant"), invalidateCache(["maintenance"]), uploadMaintenancePhoto);
router.get("/", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "maintenance", ttlSeconds: 15 }), getMaintenanceRequests);
router.get("/:id", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "maintenance", ttlSeconds: 20 }), getMaintenanceRequestById);
router.post("/", authorize("admin", "owner", "manager", "tenant"), invalidateCache(["maintenance", "notifications", "analytics"]), createMaintenanceRequest);
router.put("/:id/status", authorize("admin", "owner", "manager"), invalidateCache(["maintenance", "notifications", "analytics"]), updateMaintenanceStatus);

export default router;
