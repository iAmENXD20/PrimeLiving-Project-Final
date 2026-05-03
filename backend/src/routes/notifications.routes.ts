import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
} from "../controllers/notifications.controller";

const router = Router();

router.use(authenticate);

router.get("/", authorize("owner", "manager", "tenant"), getNotifications);
router.put("/:id/read", authorize("owner", "manager", "tenant"), markNotificationRead);
router.put("/read-all", authorize("owner", "manager", "tenant"), markAllNotificationsRead);
router.delete("/all", authorize("owner", "manager", "tenant"), deleteAllNotifications);
router.delete("/:id", authorize("owner", "manager", "tenant"), deleteNotification);

export default router;
