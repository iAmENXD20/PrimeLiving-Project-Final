import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authorize } from "../middleware/authorize";
import {
  getRevenues,
  getRevenueByMonth,
  createRevenue,
} from "../controllers/revenues.controller";

const router = Router();

router.use(authenticate);

router.get("/by-month", authorize("admin", "owner"), getRevenueByMonth);
router.get("/", authorize("admin", "owner"), getRevenues);
router.post("/", authorize("admin", "owner"), createRevenue);

export default router;
