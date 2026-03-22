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
} from "../controllers/managers.controller";

const router = Router();

router.use(authenticate);

router.get("/count", authorize("admin", "owner"), getManagerCount);
router.get("/by-auth/:authUserId", authorize("admin", "owner", "manager"), getManagerByAuthId);
router.get("/", authorize("admin", "owner"), getManagers);
router.get("/:id", authorize("admin", "owner", "manager"), getManagerById);
router.post("/", authorize("admin", "owner"), invalidateCache(["apartment_managers", "analytics"]), createManager);
router.put("/:id", authorize("admin", "owner", "manager"), invalidateCache(["apartment_managers", "analytics"]), updateManager);
router.delete("/:id", authorize("admin", "owner"), invalidateCache(["apartment_managers", "analytics"]), deleteManager);

export default router;
