import { Router } from "express";
import { z } from "zod";
import { requireWriteAccess } from "../middleware/auth.js";
import { createCost, listCosts } from "../services/costs.service.js";

const router = Router();
const schema = z.object({
  positionId: z.union([z.number(), z.string()]),
  description: z.string().min(1),
  costDate: z.string().min(1),
  amount: z.union([z.number(), z.string()]),
  currency: z.string().optional(),
  note: z.string().optional().nullable()
});

router.get("/", async (req, res, next) => {
  try {
    res.json({ success: true, data: await listCosts(req.query, req.user) });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireWriteAccess, async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await createCost(schema.parse(req.body), req.user) });
  } catch (error) {
    next(error);
  }
});

export default router;
