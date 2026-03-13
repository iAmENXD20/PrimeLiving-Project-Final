import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
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
router.post("/", authorize("admin", "owner"), createManager);
router.put("/:id", authorize("admin", "owner", "manager"), updateManager);
router.delete("/:id", authorize("admin", "owner"), deleteManager);

export default router;
