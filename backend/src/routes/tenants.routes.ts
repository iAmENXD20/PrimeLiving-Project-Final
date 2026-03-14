import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { cacheResponse, invalidateCache } from "../middleware/cache.middleware";
import {
  getTenants,
  getTenantById,
  getTenantByAuthId,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenantCount,
  assignTenantToUnit,
  removeTenantFromUnit,
} from "../controllers/tenants.controller";

const router = Router();

router.use(authenticate);

router.get("/count", authorize("admin", "owner", "manager"), cacheResponse({ namespace: "tenants", ttlSeconds: 20 }), getTenantCount);
router.get("/by-auth/:authUserId", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "tenants", ttlSeconds: 10 }), getTenantByAuthId);
router.get("/", authorize("admin", "owner", "manager"), cacheResponse({ namespace: "tenants", ttlSeconds: 20 }), getTenants);
router.get("/:id", authorize("admin", "owner", "manager", "tenant"), cacheResponse({ namespace: "tenants", ttlSeconds: 20 }), getTenantById);
router.post("/assign-unit", authorize("owner", "manager"), invalidateCache(["tenants", "apartments", "analytics", "payments"]), assignTenantToUnit);
router.post("/remove-from-unit", authorize("owner", "manager"), invalidateCache(["tenants", "apartments", "analytics"]), removeTenantFromUnit);
router.post("/", authorize("admin", "owner", "manager"), invalidateCache(["tenants", "analytics"]), createTenant);
router.put("/:id", authorize("admin", "owner", "manager", "tenant"), invalidateCache(["tenants", "analytics"]), updateTenant);
router.delete("/:id", authorize("admin", "owner", "manager"), invalidateCache(["tenants", "apartments", "analytics"]), deleteTenant);

export default router;
