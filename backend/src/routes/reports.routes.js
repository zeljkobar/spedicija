import { Router } from "express";
import { dashboardSummary, profitByCompany, profitByContainer } from "../services/reports.service.js";
import { toCsv } from "../utils/csv.js";

const router = Router();

function sendMaybeCsv(req, res, rows, filename) {
  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(toCsv(rows));
  }
  return res.json({ success: true, data: rows });
}

router.get("/dashboard", async (req, res, next) => {
  try {
    res.json({ success: true, data: await dashboardSummary() });
  } catch (error) {
    next(error);
  }
});

router.get("/profit-by-container", async (req, res, next) => {
  try {
    sendMaybeCsv(req, res, await profitByContainer(req.query), "profit-po-kontejneru");
  } catch (error) {
    next(error);
  }
});

router.get("/profit-by-company", async (req, res, next) => {
  try {
    sendMaybeCsv(req, res, await profitByCompany(req.query), "profit-po-firmi");
  } catch (error) {
    next(error);
  }
});

export default router;
