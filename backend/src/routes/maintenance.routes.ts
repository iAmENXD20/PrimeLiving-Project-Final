import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { cacheResponse, invalidateCache } from "../middleware/cache.middleware";
import {
  getMaintenanceRequests,
  getMaintenanceRequestById,
  createMaintenanceRequest,
  updateMaintenanceStatus,
  reviewMaintenanceRequest,
  getPendingMaintenanceCount,
  uploadMaintenancePhoto,
} from "../controllers/maintenance.controller";

const router = Router();

router.use(authenticate);

router.get("/count/pending", authorize("owner", "manager"), cacheResponse({ namespace: "maintenance", ttlSeconds: 15 }), getPendingMaintenanceCount);
router.post("/photos", authorize("owner", "manager", "tenant"), invalidateCache(["maintenance"]), uploadMaintenancePhoto);
router.get("/", authorize("owner", "manager", "tenant"), cacheResponse({ namespace: "maintenance", ttlSeconds: 15 }), getMaintenanceRequests);
router.get("/:id", authorize("owner", "manager", "tenant"), cacheResponse({ namespace: "maintenance", ttlSeconds: 20 }), getMaintenanceRequestById);
router.post("/", authorize("owner", "manager", "tenant"), invalidateCache(["maintenance", "notifications", "analytics"]), createMaintenanceRequest);
router.put("/:id/status", authorize("owner", "manager", "tenant"), invalidateCache(["maintenance", "notifications", "analytics"]), updateMaintenanceStatus);
router.put("/:id/review", authorize("tenant"), invalidateCache(["maintenance", "notifications", "analytics"]), reviewMaintenanceRequest);

export default router;
