import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { invalidateCache } from "../middleware/cache.middleware";
import {
  getManagers,
  getManagerById,
  getManagerByAuthId,
  createManager,
  updateManager,
  deleteManager,
  getManagerCount,
  resendManagerInvite,
  getManagerIdPhotos,
  approveManager,
} from "../controllers/managers.controller";

const router = Router();

router.use(authenticate);

router.get("/count", authorize("owner"), getManagerCount);
router.get("/by-auth/:authUserId", authorize("owner", "manager"), getManagerByAuthId);
router.get("/", authorize("owner"), getManagers);
router.get("/:id", authorize("owner", "manager"), getManagerById);
router.post("/", authorize("owner"), invalidateCache(["apartment_managers", "analytics"]), createManager);
router.post("/:id/resend-invite", authorize("owner"), resendManagerInvite);
router.get("/:id/id-photos", authorize("owner"), getManagerIdPhotos);
router.post("/:id/approve", authorize("owner"), invalidateCache(["apartment_managers", "analytics"]), approveManager);
router.put("/:id", authorize("owner", "manager"), invalidateCache(["apartment_managers", "analytics"]), updateManager);
router.delete("/:id", authorize("owner"), invalidateCache(["apartment_managers", "analytics"]), deleteManager);

export default router;
