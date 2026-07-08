import { Router } from "express";
import { z } from "zod";
import { requireWriteAccess } from "../middleware/auth.js";
import {
  createInvoicePayment,
  deleteInvoicePayment,
  listInvoicePayments
} from "../services/invoicePayments.service.js";

const router = Router();
const paymentSchema = z.object({
  paymentDate: z.string().min(1),
  amount: z.union([z.number(), z.string()]),
  method: z.enum(["ZIRO_RACUN", "GOTOVINA", "KARTICA", "KOMPENZACIJA", "OSTALO"]).optional(),
  note: z.string().optional().nullable()
});

router.get("/invoices/:invoiceId/payments", async (req, res, next) => {
  try {
    res.json({ success: true, data: await listInvoicePayments(req.params.invoiceId, req.user) });
  } catch (error) {
    next(error);
  }
});

router.post("/invoices/:invoiceId/payments", requireWriteAccess, async (req, res, next) => {
  try {
    res.status(201).json({
      success: true,
      data: await createInvoicePayment(req.params.invoiceId, paymentSchema.parse(req.body), req.user)
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/invoice-payments/:id", requireWriteAccess, async (req, res, next) => {
  try {
    await deleteInvoicePayment(req.params.id, req.user);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
