import { Router } from "express";
import { z } from "zod";
import { requireWriteAccess } from "../middleware/auth.js";
import {
  createInvoicePayment,
  settleInvoiceBatch,
  deleteInvoicePayment,
  listInvoicePayments
} from "../services/invoicePayments.service.js";

const router = Router();
const paymentSchema = z.object({
  paymentDate: z.string().date(),
  amount: z.coerce.number().finite().min(0.01),
  method: z.enum(["ZIRO_RACUN", "GOTOVINA", "KARTICA", "KOMPENZACIJA", "OSTALO"]).optional(),
  note: z.string().optional().nullable()
});

const batchSchema = paymentSchema.omit({ amount: true }).extend({
  paymentDate: z.string().date(),
  items: z.array(z.object({
    invoiceId: z.number().int().positive(),
    remainingAmount: z.number().positive().finite()
  })).min(1).max(500).refine((items) => new Set(items.map((item) => item.invoiceId)).size === items.length)
});

router.post("/invoice-payments/batch", requireWriteAccess, async (req, res, next) => {
  try {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Provjerite datum, nacin placanja i oznacene racune (najvise 500)." });
    }
    res.status(201).json({ success: true, data: await settleInvoiceBatch(parsed.data, req.user) });
  } catch (error) {
    next(error);
  }
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
