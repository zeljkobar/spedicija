import { Router } from "express";
import { z } from "zod";
import { createInvoice, deleteInvoice, listInvoices, updateInvoice } from "../services/invoices.service.js";

const router = Router();
const schema = z.object({
  positionId: z.union([z.number(), z.string()]),
  companyId: z.union([z.number(), z.string()]),
  invoiceType: z.enum(["ULAZNA", "IZLAZNA"]),
  invoiceNumber: z.string().min(1),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  amountWithoutVat: z.union([z.number(), z.string()]).optional(),
  vatAmount: z.union([z.number(), z.string()]).optional(),
  amountWithVat: z.union([z.number(), z.string()]).optional(),
  currency: z.string().optional(),
  paymentStatus: z.string().optional(),
  note: z.string().optional().nullable()
});

router.get("/", async (req, res, next) => {
  try {
    res.json({ success: true, data: await listInvoices(req.query) });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    const result = await createInvoice(data);
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    res.json({ success: true, data: await updateInvoice(req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await deleteInvoice(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
