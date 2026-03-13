import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
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

router.get("/count", authorize("admin", "owner", "manager"), getTenantCount);
router.get("/by-auth/:authUserId", authorize("admin", "owner", "manager", "tenant"), getTenantByAuthId);
router.get("/", authorize("admin", "owner", "manager"), getTenants);
router.get("/:id", authorize("admin", "owner", "manager", "tenant"), getTenantById);
router.post("/assign-unit", authorize("owner", "manager"), assignTenantToUnit);
router.post("/remove-from-unit", authorize("owner", "manager"), removeTenantFromUnit);
router.post("/", authorize("admin", "owner", "manager"), createTenant);
router.put("/:id", authorize("admin", "owner", "manager", "tenant"), updateTenant);
router.delete("/:id", authorize("admin", "owner", "manager"), deleteTenant);

export default router;
