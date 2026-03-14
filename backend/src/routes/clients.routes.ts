import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import { invalidateCache } from "../middleware/cache.middleware";
import {
  getClients,
  getClientById,
  getClientByAuthId,
  createClient,
  updateClient,
  deleteClient,
  getClientCount,
} from "../controllers/clients.controller";

const router = Router();

// All client routes require authentication
router.use(authenticate);

router.get("/count", authorize("admin"), getClientCount);
router.get("/by-auth/:authUserId", authorize("admin", "owner"), getClientByAuthId);
router.get("/", authorize("admin"), getClients);
router.get("/:id", authorize("admin", "owner"), getClientById);
router.post("/", authorize("admin"), invalidateCache(["clients", "analytics"]), createClient);
router.put("/:id", authorize("admin", "owner"), invalidateCache(["clients", "analytics"]), updateClient);
router.delete("/:id", authorize("admin"), invalidateCache(["clients", "analytics"]), deleteClient);

export default router;
