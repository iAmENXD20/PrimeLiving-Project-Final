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

// Two-way communication: any authenticated role can reply
router.post("/:id/replies", authorize("owner", "manager", "tenant"), createAnnouncementReply);
// Read thread replies
router.get("/:id/replies", authorize("owner", "manager", "tenant"), getAnnouncementReplies);

export default router;
