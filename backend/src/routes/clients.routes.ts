import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
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
router.post("/", authorize("admin"), createClient);
router.put("/:id", authorize("admin", "owner"), updateClient);
router.delete("/:id", authorize("admin"), deleteClient);

export default router;
