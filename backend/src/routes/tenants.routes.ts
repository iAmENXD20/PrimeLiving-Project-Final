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
  confirmActivation,
  approveTenant,
  getTenantIdPhotos,
  checkLeaseExpiry,
  renewTenantContract,
} from "../controllers/tenants.controller";

const router = Router();

router.use(authenticate);

router.get("/count", authorize("owner", "manager"), cacheResponse({ namespace: "tenants", ttlSeconds: 20 }), getTenantCount);
router.post("/check-lease-expiry", authorize("owner", "manager"), checkLeaseExpiry);
router.get("/by-auth/:authUserId", authorize("owner", "manager", "tenant"), cacheResponse({ namespace: "tenants", ttlSeconds: 10 }), getTenantByAuthId);
router.get("/", authorize("owner", "manager"), cacheResponse({ namespace: "tenants", ttlSeconds: 20 }), getTenants);
router.get("/:id", authorize("owner", "manager", "tenant"), cacheResponse({ namespace: "tenants", ttlSeconds: 20 }), getTenantById);
router.post("/assign-unit", authorize("owner", "manager"), invalidateCache(["tenants", "apartments", "analytics", "payments"]), assignTenantToUnit);
router.post("/remove-from-unit", authorize("owner", "manager"), invalidateCache(["tenants", "apartments", "analytics"]), removeTenantFromUnit);
router.put("/confirm-activation", authorize("tenant", "manager"), invalidateCache(["tenants", "apartment_managers"]), confirmActivation);
router.get("/:id/id-photos", authorize("owner", "manager"), getTenantIdPhotos);
router.put("/:id/approve", authorize("owner", "manager"), invalidateCache(["tenants", "analytics"]), approveTenant);
router.put("/:id/renew", authorize("tenant"), invalidateCache(["tenants"]), renewTenantContract);
router.post("/", authorize("owner", "manager"), invalidateCache(["tenants", "analytics"]), createTenant);
router.put("/:id", authorize("owner", "manager", "tenant"), invalidateCache(["tenants", "analytics"]), updateTenant);
router.delete("/:id", authorize("owner", "manager"), invalidateCache(["tenants", "apartments", "analytics"]), deleteTenant);

export default router;
