import cors from "cors";
import express from "express";
import morgan from "morgan";
import companiesRoutes from "./routes/companies.routes.js";
import costsRoutes from "./routes/costs.routes.js";
import invoicesRoutes from "./routes/invoices.routes.js";
import positionsRoutes from "./routes/positions.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

export const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "API radi" });
});

app.use("/api/companies", companiesRoutes);
app.use("/api/positions", positionsRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/costs", costsRoutes);
app.use("/api/reports", reportsRoutes);

app.use(notFound);
app.use(errorHandler);
