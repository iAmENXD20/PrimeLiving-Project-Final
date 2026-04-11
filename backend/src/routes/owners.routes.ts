import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { invalidateCache } from "../middleware/cache.middleware";
import {
  getOwners,
  getOwnerById,
  getOwnerLocation,
  getOwnerByAuthId,
  createOwner,
  updateOwner,
  deleteOwner,
  getOwnerCount,
} from "../controllers/owners.controller";

const router = Router();

// All owner routes require authentication
router.use(authenticate);

router.get("/count", authorize("owner"), getOwnerCount);
router.get("/by-auth/:authUserId", authorize("owner"), getOwnerByAuthId);
router.get("/", authorize("owner"), getOwners);
router.get("/:id/location", authorize("owner", "manager", "tenant"), getOwnerLocation);
router.get("/:id", authorize("owner"), getOwnerById);
router.post("/", authorize("owner"), invalidateCache(["apartment_owners", "analytics"]), createOwner);
router.put("/:id", authorize("owner"), invalidateCache(["apartment_owners", "analytics"]), updateOwner);
router.delete("/:id", authorize("owner"), invalidateCache(["apartment_owners", "analytics"]), deleteOwner);

export default router;
