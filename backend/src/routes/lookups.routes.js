import { Router } from "express";
import { z } from "zod";
import { requireOrganizationAdmin } from "../middleware/auth.js";
import { createLookup, listLookup, updateLookup } from "../services/lookups.service.js";

const router = Router();
const schema = z.object({
  organizationId: z.union([z.number(), z.string()]).optional().nullable(),
  name: z.string().trim().min(1),
  active: z.boolean().optional(),
  note: z.string().optional().nullable()
});
const updateSchema = schema.partial();

router.get("/:type", async (req, res, next) => {
  try {
    res.json({ success: true, data: await listLookup(req.params.type, req.query, req.user) });
  } catch (error) {
    next(error);
  }
});

router.post("/:type", requireOrganizationAdmin, async (req, res, next) => {
  try {
    res.status(201).json({ success: true, data: await createLookup(req.params.type, schema.parse(req.body), req.user) });
  } catch (error) {
    next(error);
  }
});

router.put("/:type/:id", requireOrganizationAdmin, async (req, res, next) => {
  try {
    res.json({ success: true, data: await updateLookup(req.params.type, req.params.id, updateSchema.parse(req.body), req.user) });
  } catch (error) {
    next(error);
  }
});

export default router;
