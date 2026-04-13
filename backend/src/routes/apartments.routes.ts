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
  getProperties,
  createProperty,
  updateProperty,
  deleteProperty,
} from "../controllers/apartments.controller";
import {
  getOccupants,
  addOccupant,
  updateOccupant,
  deleteOccupant,
} from "../controllers/occupants.controller";

const router = Router();

router.use(authenticate);

// Property-level (buildings/locations) routes
router.get("/properties", authorize("owner", "manager"), getProperties);
router.post("/properties", authorize("owner"), invalidateCache(["apartments", "analytics"]), createProperty);
router.put("/properties/:id", authorize("owner"), invalidateCache(["apartments", "analytics"]), updateProperty);
router.delete("/properties/:id", authorize("owner"), invalidateCache(["apartments", "tenants", "analytics"]), deleteProperty);

// Occupant routes
router.get("/occupants/:unitId", authorize("owner", "manager", "tenant"), getOccupants);
router.post("/occupants", authorize("tenant"), addOccupant);
router.put("/occupants/:id", authorize("tenant"), updateOccupant);
router.delete("/occupants/:id", authorize("tenant"), deleteOccupant);

// Unit-level routes
router.get("/count", authorize("owner", "manager"), getApartmentCount);
router.get("/with-tenants", authorize("owner", "manager"), getApartmentsWithTenants);
router.get("/", authorize("owner", "manager"), getApartments);
router.get("/:id", authorize("owner", "manager", "tenant"), getApartmentById);
router.post("/bulk", authorize("owner"), invalidateCache(["apartments", "tenants", "analytics"]), createApartmentsBulk);
router.post("/", authorize("owner"), invalidateCache(["apartments", "analytics"]), createApartment);
router.put("/:id/payment-due-day", authorize("owner", "manager"), invalidateCache(["apartments", "payments", "analytics"]), setPaymentDueDay);
router.put("/:id", authorize("owner", "manager"), invalidateCache(["apartments", "analytics"]), updateApartment);
router.delete("/:id", authorize("owner"), invalidateCache(["apartments", "tenants", "analytics"]), deleteApartment);

export default router;
