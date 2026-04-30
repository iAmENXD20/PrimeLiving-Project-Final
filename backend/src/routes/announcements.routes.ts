import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  deleteAnnouncement,
  createAnnouncementReply,
  getAnnouncementReplies,
} from "../controllers/announcements.controller";

const router = Router();

router.use(authenticate);

router.get("/", authorize("owner", "manager", "tenant"), getAnnouncements);
router.get("/:id", authorize("owner", "manager", "tenant"), getAnnouncementById);
router.post("/", authorize("owner", "manager"), createAnnouncement);
router.delete("/:id", authorize("owner", "manager"), deleteAnnouncement);

// Two-way communication: tenant replies to an announcement
router.post("/:id/replies", authorize("tenant"), createAnnouncementReply);
// Owner/manager reads replies for an announcement
router.get("/:id/replies", authorize("owner", "manager"), getAnnouncementReplies);

export default router;
