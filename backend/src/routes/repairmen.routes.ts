import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { cacheResponse, invalidateCache } from "../middleware/cache.middleware";
import {
  getRepairmen,
  createRepairman,
  updateRepairman,
  deleteRepairman,
} from "../controllers/repairmen.controller";

const router = Router();

router.use(authenticate);

router.get(
  "/",
  authorize("owner", "manager"),
  cacheResponse({ namespace: "repairmen", ttlSeconds: 30 }),
  getRepairmen
);

router.post(
  "/",
  authorize("owner", "manager"),
  invalidateCache(["repairmen"]),
  createRepairman
);

router.put(
  "/:id",
  authorize("owner", "manager"),
  invalidateCache(["repairmen"]),
  updateRepairman
);

router.delete(
  "/:id",
  authorize("owner", "manager"),
  invalidateCache(["repairmen"]),
  deleteRepairman
);

export default router;
