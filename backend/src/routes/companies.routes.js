import { Router } from "express";
import { z } from "zod";
import {
  createCompany,
  deleteCompany,
  getCompany,
  listCompanies,
  updateCompany
} from "../services/companies.service.js";

const router = Router();
const schema = z.object({
  name: z.string().min(1),
  pib: z.string().optional().nullable(),
  vatNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  companyType: z.string().optional(),
  note: z.string().optional().nullable()
});

router.get("/", async (req, res, next) => {
  try {
    res.json({ success: true, data: await listCompanies(req.query) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const company = await getCompany(req.params.id);
    if (!company) return res.status(404).json({ success: false, message: "Firma nije pronadjena" });
    res.json({ success: true, data: company });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    res.status(201).json({ success: true, data: await createCompany(data) });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    res.json({ success: true, data: await updateCompany(req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await deleteCompany(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
