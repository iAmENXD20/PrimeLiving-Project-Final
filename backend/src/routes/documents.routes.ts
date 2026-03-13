import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getDocuments,
  getDocumentById,
  createDocument,
  deleteDocument,
} from "../controllers/documents.controller";

const router = Router();

router.use(authenticate);

router.get("/", authorize("admin", "owner", "manager"), getDocuments);
router.get("/:id", authorize("admin", "owner", "manager"), getDocumentById);
router.post("/", authorize("manager"), createDocument);
router.delete("/:id", authorize("admin", "owner", "manager"), deleteDocument);

export default router;
