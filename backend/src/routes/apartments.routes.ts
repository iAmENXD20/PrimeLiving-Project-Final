import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
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
router.post("/bulk", authorize("admin", "owner"), createApartmentsBulk);
router.post("/", authorize("admin", "owner"), createApartment);
router.put("/:id/payment-due-day", authorize("owner", "manager"), setPaymentDueDay);
router.put("/:id", authorize("admin", "owner", "manager"), updateApartment);
router.delete("/:id", authorize("admin", "owner"), deleteApartment);

export default router;
