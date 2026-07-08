import { prisma } from "../db.js";
import { tenantWhere } from "../middleware/auth.js";
import { paymentSummary } from "./invoicePayments.service.js";
import { buildFinancialSummary } from "../utils/financialSummary.js";
import { roundMoney, toNumber } from "../utils/money.js";

function periodWhere(query, field = "openingDate") {
  if (!query.dateFrom && !query.dateTo) return {};
  return {
    [field]: {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
    }
  };
}

function positionScopeWhere(query = {}, user) {
  return {
    ...tenantWhere(user),
    ...(query.organizationId && user?.role === "SUPER_ADMIN" ? { organizationId: Number(query.organizationId) } : {}),
    ...(query.companyId ? { companyId: Number(query.companyId) } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.containerNumber ? { containerNumber: { contains: query.containerNumber, mode: "insensitive" } } : {})
  };
}

function reportWhere(query = {}, user, dateField = "openingDate") {
  return {
    ...positionScopeWhere(query, user),
    ...periodWhere(query, dateField)
  };
}

function accountingAmount(invoice) {
  const withoutVat = toNumber(invoice.amountWithoutVat);
  return withoutVat > 0 ? withoutVat : toNumber(invoice.amountWithVat);
}

function monthKey(value) {
  return value ? new Date(value).toISOString().slice(0, 7) : "Bez perioda";
}

function invoiceWhere(query = {}, user, invoiceType) {
  return {
    invoiceType,
    ...(query.companyId ? { companyId: Number(query.companyId) } : {}),
    ...periodWhere(query, query.dateBasis === "dueDate" ? "dueDate" : "invoiceDate"),
    position: positionScopeWhere({ ...query, companyId: undefined }, user)
  };
}

function invoiceRow(invoice) {
  const summary = paymentSummary(invoice);
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate?.toISOString().slice(0, 10) || "",
    dueDate: invoice.dueDate?.toISOString().slice(0, 10) || "",
    company: invoice.company?.name || "",
    containerNumber: invoice.position?.containerNumber || "",
    positionStatus: invoice.position?.status || "",
    amountWithoutVat: roundMoney(toNumber(invoice.amountWithoutVat)),
    vatAmount: roundMoney(toNumber(invoice.vatAmount)),
    amountWithVat: roundMoney(toNumber(invoice.amountWithVat)),
    accountingAmount: roundMoney(accountingAmount(invoice)),
    paidAmount: summary.paidAmount,
    remainingAmount: summary.remainingAmount,
    paymentStatus: summary.computedPaymentStatus,
    note: invoice.note || ""
  };
}

export async function profitByContainer(query = {}, user) {
  const positions = await prisma.position.findMany({
    where: reportWhere(query, user),
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

export async function profitByCompany(query = {}, user) {
  const rows = await profitByContainer(query, user);
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

export async function profitByPeriod(query = {}, user) {
  const dateBasis = query.dateBasis || "openingDate";
  if (["invoiceDate", "dueDate"].includes(dateBasis)) {
    const invoiceDateField = dateBasis === "dueDate" ? "dueDate" : "invoiceDate";
    const invoices = await prisma.invoice.findMany({
      where: {
        ...periodWhere(query, invoiceDateField),
        position: positionScopeWhere(query, user)
      }
    });
    const additionalCosts =
      dateBasis === "invoiceDate"
        ? await prisma.additionalCost.findMany({
            where: {
              ...periodWhere(query, "costDate"),
              position: positionScopeWhere(query, user)
            }
          })
        : [];
    const grouped = new Map();

    for (const invoice of invoices) {
      const key = monthKey(invoice[invoiceDateField]);
      const current = grouped.get(key) || {
        period: key,
        positionsCount: new Set(),
        totalRevenue: 0,
        totalCosts: 0,
        profit: 0,
        margin: 0
      };
      current.positionsCount.add(invoice.positionId);
      if (invoice.invoiceType === "IZLAZNA") current.totalRevenue += accountingAmount(invoice);
      if (invoice.invoiceType === "ULAZNA") current.totalCosts += accountingAmount(invoice);
      grouped.set(key, current);
    }

    for (const cost of additionalCosts) {
      const key = monthKey(cost.costDate);
      const current = grouped.get(key) || {
        period: key,
        positionsCount: new Set(),
        totalRevenue: 0,
        totalCosts: 0,
        profit: 0,
        margin: 0
      };
      current.positionsCount.add(cost.positionId);
      current.totalCosts += toNumber(cost.amount);
      grouped.set(key, current);
    }

    return Array.from(grouped.values())
      .map((row) => {
        const profit = row.totalRevenue - row.totalCosts;
        return {
          period: row.period,
          positionsCount: row.positionsCount.size,
          totalRevenue: roundMoney(row.totalRevenue),
          totalCosts: roundMoney(row.totalCosts),
          profit: roundMoney(profit),
          margin: row.totalRevenue > 0 ? roundMoney((profit / row.totalRevenue) * 100) : 0
        };
      })
      .sort((a, b) => b.period.localeCompare(a.period));
  }

  const dateField = dateBasis === "closingDate" ? "closingDate" : "openingDate";
  const positions = await prisma.position.findMany({
    where: reportWhere(query, user, dateField),
    include: { company: true, invoices: true, additionalCosts: true }
  });
  const periodsByPosition = new Map(
    positions.map((position) => [position.id, monthKey(position[dateField])])
  );
  const rows = positions.map((position) => ({
    positionId: position.id,
    containerNumber: position.containerNumber,
    company: position.company?.name || "",
    status: position.status,
    ...buildFinancialSummary(position)
  }));
  const grouped = new Map();

  for (const row of rows) {
    const key = periodsByPosition.get(row.positionId) || "Bez perioda";
    const current = grouped.get(key) || {
      period: key,
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

  return Array.from(grouped.values())
    .sort((a, b) => b.period.localeCompare(a.period))
    .map((row) => ({
      ...row,
      totalRevenue: Math.round(row.totalRevenue * 100) / 100,
      totalCosts: Math.round(row.totalCosts * 100) / 100,
      profit: Math.round(row.profit * 100) / 100,
      margin: Math.round(row.margin * 100) / 100
    }));
}

export async function openPositions(query = {}, user) {
  const positions = await prisma.position.findMany({
    where: {
      ...reportWhere({ ...query, status: undefined }, user),
      status: { notIn: ["ZATVORENA", "STORNIRANA"] }
    },
    include: { company: true, invoices: true, additionalCosts: true },
    orderBy: { openingDate: "desc" }
  });

  const today = new Date();
  return positions.map((position) => ({
    positionId: position.id,
    containerNumber: position.containerNumber,
    company: position.company?.name || "",
    status: position.status,
    openingDate: position.openingDate.toISOString().slice(0, 10),
    ageDays: Math.max(0, Math.floor((today - position.openingDate) / 86400000)),
    ...buildFinancialSummary(position)
  }));
}

export async function supplierInvoices(query = {}, user) {
  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere(query, user, "ULAZNA"),
    include: { company: true, position: true, payments: true },
    orderBy: { invoiceDate: "desc" }
  });
  return invoices.map(invoiceRow);
}

export async function customerInvoices(query = {}, user) {
  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere(query, user, "IZLAZNA"),
    include: { company: true, position: true, payments: true },
    orderBy: { invoiceDate: "desc" }
  });
  return invoices.map(invoiceRow);
}

export async function dashboardSummary(user) {
  const positions = await prisma.position.findMany({
    where: tenantWhere(user),
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
