import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getExpenses, createExpense, deleteExpense } from "../controllers/expenses.controller";

const router = Router();

router.get("/", authenticate, getExpenses);
router.post("/", authenticate, createExpense);
router.delete("/:id", authenticate, deleteExpense);

export default router;
