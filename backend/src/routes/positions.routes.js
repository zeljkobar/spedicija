import { Router } from "express";
import { z } from "zod";
import {
  closePosition,
  createPosition,
  getPosition,
  getPositionByContainer,
  listPositions,
  updatePosition
} from "../services/positions.service.js";

const router = Router();
const schema = z.object({
  containerNumber: z.string().min(1),
  companyId: z.union([z.number(), z.string()]).optional().nullable(),
  title: z.string().optional().nullable(),
  openingDate: z.string().optional(),
  closingDate: z.string().optional().nullable(),
  status: z.string().optional(),
  origin: z.string().optional().nullable(),
  destination: z.string().optional().nullable(),
  vessel: z.string().optional().nullable(),
  bookingNumber: z.string().optional().nullable(),
  blNumber: z.string().optional().nullable(),
  note: z.string().optional().nullable()
});

router.get("/", async (req, res, next) => {
  try {
    res.json({ success: true, data: await listPositions(req.query) });
  } catch (error) {
    next(error);
  }
});

router.get("/container/:containerNumber", async (req, res, next) => {
  try {
    const position = await getPositionByContainer(req.params.containerNumber);
    if (!position) return res.status(404).json({ success: false, message: "Pozicija nije pronadjena" });
    res.json({ success: true, data: position });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const position = await getPosition(req.params.id);
    if (!position) return res.status(404).json({ success: false, message: "Pozicija nije pronadjena" });
    res.json({ success: true, data: position });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    res.status(201).json({ success: true, data: await createPosition(data) });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    res.json({ success: true, data: await updatePosition(req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/close", async (req, res, next) => {
  try {
    res.json({ success: true, data: await closePosition(req.params.id) });
  } catch (error) {
    next(error);
  }
});

export default router;
