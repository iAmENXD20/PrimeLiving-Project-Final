import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { cacheResponse } from "../middleware/cache.middleware";
import {
  getOverviewStats,
  getOwnerStats,
  getOwnerDetailStats,
  getManagerStats,
  getTenantStats,
  getUserDistribution,
  getTenantsPerApartment,
  getAllUsers,
  getMaintenanceByMonth,
  getMaintenanceSummary,
} from "../controllers/analytics.controller";

const router = Router();

router.use(authenticate);

router.get("/overview", authorize("owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getOverviewStats);
router.get("/all-users", authorize("owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getAllUsers);
router.get("/user-distribution", authorize("owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getUserDistribution);
router.get("/tenants-per-apartment", authorize("owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getTenantsPerApartment);
router.get("/maintenance-by-month", authorize("owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 30 }), getMaintenanceByMonth);
router.get("/maintenance-summary", authorize("owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 30 }), getMaintenanceSummary);
router.get("/owner/:apartmentownerId/detail-stats", authorize("owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 30 }), getOwnerDetailStats);
router.get("/owner/:apartmentownerId", authorize("owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getOwnerStats);
router.get("/manager/:managerId", authorize("owner", "manager"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getManagerStats);
router.get("/tenant/:tenantId", authorize("owner", "manager", "tenant"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getTenantStats);

export default router;
