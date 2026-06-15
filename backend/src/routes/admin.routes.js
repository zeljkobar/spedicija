import { Router } from "express";
import { z } from "zod";
import { requireSuperAdmin } from "../middleware/auth.js";
import { createOrganization, createWorker, listOrganizations, updateWorker } from "../services/admin.service.js";

const router = Router();

router.use(requireSuperAdmin);

const organizationSchema = z.object({
  name: z.string().min(1),
  pib: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable()
});

const workerSchema = z.object({
  organizationId: z.union([z.number(), z.string()]),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "USER", "VIEWER"]).optional(),
  active: z.boolean().optional()
});

const updateWorkerSchema = workerSchema.partial().extend({
  password: z.string().min(6).optional()
});

router.get("/organizations", async (req, res, next) => {
  try {
    res.json({ success: true, data: await listOrganizations() });
  } catch (error) {
    next(error);
  }
});

router.post("/organizations", async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await createOrganization(organizationSchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});

router.post("/workers", async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await createWorker(workerSchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});

router.put("/workers/:id", async (req, res, next) => {
  try {
    res.json({ success: true, data: await updateWorker(req.params.id, updateWorkerSchema.parse(req.body)) });
  } catch (error) {
    next(error);
  }
});

export default router;
