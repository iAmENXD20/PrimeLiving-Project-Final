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

router.get("/by-month", authorize("owner"), getRevenueByMonth);
router.get("/", authorize("owner"), getRevenues);
router.post("/", authorize("owner"), createRevenue);

export default router;
