import { prisma } from "../db.js";
import { buildFinancialSummary } from "../utils/financialSummary.js";

function periodWhere(query) {
  if (!query.dateFrom && !query.dateTo) return {};
  return {
    openingDate: {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
    }
  };
}

export async function profitByContainer(query = {}) {
  const positions = await prisma.position.findMany({
    where: {
      ...periodWhere(query),
      ...(query.companyId ? { companyId: Number(query.companyId) } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.containerNumber ? { containerNumber: { contains: query.containerNumber, mode: "insensitive" } } : {})
    },
    include: { company: true, invoices: true, additionalCosts: true },
    orderBy: { openingDate: "desc" }
  });

  return positions.map((position) => ({
    positionId: position.id,
    containerNumber: position.containerNumber,
    company: position.company?.name || "",
    status: position.status,
    ...buildFinancialSummary(position)
  }));
}

export async function profitByCompany(query = {}) {
  const rows = await profitByContainer(query);
  const grouped = new Map();

  for (const row of rows) {
    const key = row.company || "Bez firme";
    const current = grouped.get(key) || {
      company: key,
      positionsCount: 0,
      totalRevenue: 0,
      totalCosts: 0,
      profit: 0,
      margin: 0
    };

    current.positionsCount += 1;
    current.totalRevenue += row.totalRevenue;
    current.totalCosts += row.totalCosts;
    current.profit += row.profit;
    current.margin = current.totalRevenue > 0 ? (current.profit / current.totalRevenue) * 100 : 0;
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).map((row) => ({
    ...row,
    totalRevenue: Math.round(row.totalRevenue * 100) / 100,
    totalCosts: Math.round(row.totalCosts * 100) / 100,
    profit: Math.round(row.profit * 100) / 100,
    margin: Math.round(row.margin * 100) / 100
  }));
}

export async function dashboardSummary() {
  const positions = await prisma.position.findMany({
    include: { company: true, invoices: true, additionalCosts: true },
    orderBy: { openingDate: "desc" }
  });

  const totals = positions.reduce(
    (acc, position) => {
      const summary = buildFinancialSummary(position);
      acc.totalRevenue += summary.totalRevenue;
      acc.totalCosts += summary.totalCosts;
      acc.profit += summary.profit;
      if (summary.profit >= 0) acc.profitable += 1;
      if (summary.profit < 0) acc.loss += 1;
      return acc;
    },
    { totalRevenue: 0, totalCosts: 0, profit: 0, profitable: 0, loss: 0 }
  );

  return {
    openPositions: positions.filter((position) => position.status !== "ZATVORENA").length,
    closedPositions: positions.filter((position) => position.status === "ZATVORENA").length,
    ...totals,
    latestPositions: positions.slice(0, 5).map((position) => ({
      id: position.id,
      containerNumber: position.containerNumber,
      company: position.company?.name || "",
      status: position.status,
      financial: buildFinancialSummary(position)
    }))
  };
}
