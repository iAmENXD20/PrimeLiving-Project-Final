import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { invalidateCache } from "../middleware/cache.middleware";
import {
  getApartments,
  getApartmentById,
  getApartmentsWithTenants,
  createApartment,
  createApartmentsBulk,
  updateApartment,
  deleteApartment,
  getApartmentCount,
  setPaymentDueDay,
} from "../controllers/apartments.controller";

const router = Router();

router.use(authenticate);

router.get("/count", authorize("admin", "owner", "manager"), getApartmentCount);
router.get("/with-tenants", authorize("admin", "owner", "manager"), getApartmentsWithTenants);
router.get("/", authorize("admin", "owner", "manager"), getApartments);
router.get("/:id", authorize("admin", "owner", "manager", "tenant"), getApartmentById);
router.post("/bulk", authorize("admin", "owner"), invalidateCache(["apartments", "tenants", "analytics"]), createApartmentsBulk);
router.post("/", authorize("admin", "owner"), invalidateCache(["apartments", "analytics"]), createApartment);
router.put("/:id/payment-due-day", authorize("owner", "manager"), invalidateCache(["apartments", "payments", "analytics"]), setPaymentDueDay);
router.put("/:id", authorize("admin", "owner", "manager"), invalidateCache(["apartments", "analytics"]), updateApartment);
router.delete("/:id", authorize("admin", "owner"), invalidateCache(["apartments", "tenants", "analytics"]), deleteApartment);

export default router;
