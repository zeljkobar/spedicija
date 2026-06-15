import { Router } from "express";
import { z } from "zod";
import { requireOrganizationAdmin } from "../middleware/auth.js";
import { createTeamWorker, listTeam, updateTeamWorker } from "../services/team.service.js";

const router = Router();

router.use(requireOrganizationAdmin);

const workerSchema = z.object({
  organizationId: z.union([z.number(), z.string()]).optional(),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "USER", "VIEWER"]).optional(),
  active: z.boolean().optional()
});

const updateWorkerSchema = workerSchema.partial().extend({
  password: z.string().min(6).optional()
});

router.get("/workers", async (req, res, next) => {
  try {
    res.json({ success: true, data: await listTeam(req.user, req.query) });
  } catch (error) {
    next(error);
  }
});

router.post("/workers", async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await createTeamWorker(req.user, workerSchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});

router.put("/workers/:id", async (req, res, next) => {
  try {
    res.json({ success: true, data: await updateTeamWorker(req.user, req.params.id, updateWorkerSchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});

export default router;
