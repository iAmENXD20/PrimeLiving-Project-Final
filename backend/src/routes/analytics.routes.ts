import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
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

router.get("/overview", authorize("admin"), getOverviewStats);
router.get("/all-users", authorize("admin"), getAllUsers);
router.get("/user-distribution", authorize("admin"), getUserDistribution);
router.get("/tenants-per-apartment", authorize("admin"), getTenantsPerApartment);
router.get("/maintenance-by-month", authorize("admin", "owner"), getMaintenanceByMonth);
router.get("/owner/:clientId/detail-stats", authorize("admin", "owner"), getClientDetailStats);
router.get("/owner/:clientId", authorize("admin", "owner"), getOwnerStats);
router.get("/manager/:managerId", authorize("admin", "owner", "manager"), getManagerStats);
router.get("/tenant/:tenantId", authorize("admin", "owner", "manager", "tenant"), getTenantStats);

export default router;
