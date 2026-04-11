import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getDocuments,
  getDocumentById,
  createDocument,
  uploadDocument,
  deleteDocument,
} from "../controllers/documents.controller";

const router = Router();

router.use(authenticate);

router.get("/", authorize("owner", "manager", "tenant"), getDocuments);
router.get("/:id", authorize("owner", "manager"), getDocumentById);
router.post("/upload", authorize("owner", "manager"), uploadDocument);
router.post("/", authorize("owner", "manager"), createDocument);
router.delete("/:id", authorize("owner", "manager"), deleteDocument);

export default router;
