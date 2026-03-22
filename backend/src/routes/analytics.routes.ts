import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { cacheResponse } from "../middleware/cache.middleware";
import {
  getOverviewStats,
  getOwnerStats,
  getClientDetailStats,
  getManagerStats,
  getTenantStats,
  getUserDistribution,
  getTenantsPerApartment,
  getAllUsers,
  getMaintenanceByMonth,
} from "../controllers/analytics.controller";

const router = Router();

router.use(authenticate);

router.get("/overview", authorize("admin"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getOverviewStats);
router.get("/all-users", authorize("admin"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getAllUsers);
router.get("/user-distribution", authorize("admin"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getUserDistribution);
router.get("/tenants-per-apartment", authorize("admin"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getTenantsPerApartment);
router.get("/maintenance-by-month", authorize("admin", "owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 30 }), getMaintenanceByMonth);
router.get("/owner/:apartmentownerId/detail-stats", authorize("admin", "owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 30 }), getClientDetailStats);
router.get("/owner/:apartmentownerId", authorize("admin", "owner"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getOwnerStats);
router.get("/manager/:managerId", authorize("admin", "owner", "manager"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getManagerStats);
router.get("/tenant/:tenantId", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "analytics", ttlSeconds: 20 }), getTenantStats);

export default router;
