import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
  sendTestSms,
  getSmsConfigStatus,
} from "../controllers/notifications.controller";

const router = Router();

router.use(authenticate);

router.get("/", authorize("admin", "owner", "manager", "tenant"), getNotifications);
router.get("/sms-config", authorize("admin", "owner", "manager"), getSmsConfigStatus);
router.put("/:id/read", authorize("admin", "owner", "manager", "tenant"), markNotificationRead);
router.put("/read-all", authorize("admin", "owner", "manager", "tenant"), markAllNotificationsRead);
router.delete("/all", authorize("admin", "owner", "manager", "tenant"), deleteAllNotifications);
router.delete("/:id", authorize("admin", "owner", "manager", "tenant"), deleteNotification);
router.post("/test-sms", authorize("admin", "owner", "manager"), sendTestSms);

export default router;
