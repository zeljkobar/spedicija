import { prisma } from "../db.js";
import { tenantWhere } from "../middleware/auth.js";
import { paymentSummary } from "./invoicePayments.service.js";
import { buildFinancialSummary } from "../utils/financialSummary.js";
import { normalizeContainerNumber } from "../utils/normalizeContainerNumber.js";

const includeDetails = {
  company: true,
  containerTypeRef: true,
  carrierRef: true,
  salesAgentRef: true,
  invoices: { include: { company: true, payments: true }, orderBy: { invoiceDate: "desc" } },
  additionalCosts: { orderBy: { costDate: "desc" } }
};

function withInvoicePayments(invoice) {
  const summary = paymentSummary(invoice);
  return {
    ...invoice,
    paidAmount: summary.paidAmount,
    remainingAmount: summary.remainingAmount,
    computedPaymentStatus: summary.computedPaymentStatus
  };
}

function organizationIdForCreate(data, user) {
  if (user?.role === "SUPER_ADMIN") return data.organizationId ? Number(data.organizationId) : null;
  return Number(user.organizationId);
}

async function getRequiredLookup(model, id, organizationId, message) {
  const item = await model.findFirst({
    where: { id: Number(id), organizationId, active: true }
  });
  if (!item) {
    const error = new Error(message);
    error.status = 400;
    throw error;
  }
  return item;
}

export function withSummary(position) {
  if (!position) return null;
  return {
    ...position,
    invoices: (position.invoices || []).map(withInvoicePayments),
    financial: buildFinancialSummary(position)
  };
}

export async function listPositions(query = {}, user) {
  const search = query.search?.trim();
  const status = query.status?.trim();
  const positions = await prisma.position.findMany({
    where: {
      ...tenantWhere(user),
      ...(query.organizationId && user?.role === "SUPER_ADMIN" ? { organizationId: Number(query.organizationId) } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { containerNumber: { contains: normalizeContainerNumber(search), mode: "insensitive" } },
              { company: { name: { contains: search, mode: "insensitive" } } }
            ]
          }
        : {})
    },
    include: includeDetails,
    orderBy: { openingDate: "desc" }
  });

  return positions.map(withSummary);
}

export async function getPosition(id, user) {
  const position = await prisma.position.findFirst({
    where: { id: Number(id), ...tenantWhere(user) },
    include: includeDetails
  });
  return withSummary(position);
}

export async function getPositionByContainer(containerNumber, user) {
  const normalized = normalizeContainerNumber(containerNumber);
  const position = await prisma.position.findFirst({
    where: { containerNumber: normalized, ...tenantWhere(user) },
    include: includeDetails
  });
  return withSummary(position);
}

export async function createPosition(data, user) {
  const organizationId = organizationIdForCreate(data, user);
  if (!organizationId) {
    const error = new Error("Izaberi spediciju za poziciju.");
    error.status = 400;
    throw error;
  }

  const containerNumber = normalizeContainerNumber(data.containerNumber);

  const [containerType, carrier, salesAgent] = await Promise.all([
    getRequiredLookup(prisma.containerType, data.containerTypeId, organizationId, "Izaberi validan tip kontejnera."),
    getRequiredLookup(prisma.carrier, data.carrierId, organizationId, "Izaberi validnog brodara."),
    getRequiredLookup(prisma.salesAgent, data.salesAgentId, organizationId, "Izaberi validnog komercijalistu.")
  ]);

  return prisma.position.create({
    data: {
      containerNumber,
      organizationId,
      companyId: data.companyId ? Number(data.companyId) : null,
      title: data.title || null,
      containerTypeId: containerType.id,
      carrierId: carrier.id,
      salesAgentId: salesAgent.id,
      containerType: containerType.name,
      carrier: carrier.name,
      salesAgent: salesAgent.name,
      jci: data.jci,
      manipulation: data.manipulation || null,
      goods: data.goods || null,
      openingDate: data.openingDate ? new Date(data.openingDate) : new Date(),
      closingDate: data.closingDate ? new Date(data.closingDate) : null,
      status: data.status || "OTVORENA",
      origin: data.origin || null,
      destination: data.destination || null,
      vessel: data.vessel || null,
      bookingNumber: data.bookingNumber || null,
      blNumber: data.blNumber || null,
      note: data.note || null
    }
  });
}

export async function updatePosition(id, data, user) {
  const existing = await prisma.position.findFirst({ where: { id: Number(id), ...tenantWhere(user) } });
  if (!existing) {
    const error = new Error("Pozicija nije pronadjena.");
    error.status = 404;
    throw error;
  }

  const payload = { ...data };
  delete payload.organizationId;
  if (payload.containerNumber) payload.containerNumber = normalizeContainerNumber(payload.containerNumber);
  if ("companyId" in payload) payload.companyId = payload.companyId ? Number(payload.companyId) : null;
  if (payload.openingDate) payload.openingDate = new Date(payload.openingDate);
  if (payload.closingDate) payload.closingDate = new Date(payload.closingDate);
  if (payload.closingDate === "") payload.closingDate = null;
  if (payload.manipulation === "") payload.manipulation = null;
  if (payload.goods === "") payload.goods = null;
  if (payload.note === "") payload.note = null;
  if ("containerTypeId" in payload) {
    const containerType = await getRequiredLookup(
      prisma.containerType,
      payload.containerTypeId,
      existing.organizationId,
      "Izaberi validan tip kontejnera."
    );
    payload.containerTypeId = containerType.id;
    payload.containerType = containerType.name;
  }
  if ("carrierId" in payload) {
    const carrier = await getRequiredLookup(
      prisma.carrier,
      payload.carrierId,
      existing.organizationId,
      "Izaberi validnog brodara."
    );
    payload.carrierId = carrier.id;
    payload.carrier = carrier.name;
  }
  if ("salesAgentId" in payload) {
    const salesAgent = await getRequiredLookup(
      prisma.salesAgent,
      payload.salesAgentId,
      existing.organizationId,
      "Izaberi validnog komercijalistu."
    );
    payload.salesAgentId = salesAgent.id;
    payload.salesAgent = salesAgent.name;
  }

  return prisma.position.update({
    where: { id: Number(id) },
    data: payload
  });
}

export async function deletePosition(id, user) {
  const position = await prisma.position.findFirst({
    where: { id: Number(id), ...tenantWhere(user) },
    include: { invoices: { select: { id: true } } }
  });
  if (!position) {
    const error = new Error("Pozicija nije pronadjena.");
    error.status = 404;
    throw error;
  }

  const invoiceIds = position.invoices.map((invoice) => invoice.id);

  return prisma.$transaction(async (tx) => {
    if (invoiceIds.length) {
      await tx.invoicePayment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    }
    await tx.additionalCost.deleteMany({ where: { positionId: position.id } });
    return tx.position.delete({ where: { id: position.id } });
  });
}

export async function closePosition(id, user) {
  const existing = await prisma.position.findFirst({ where: { id: Number(id), ...tenantWhere(user) } });
  if (!existing) {
    const error = new Error("Pozicija nije pronadjena.");
    error.status = 404;
    throw error;
  }

  return prisma.position.update({
    where: { id: Number(id) },
    data: {
      status: "ZATVORENA",
      closingDate: new Date()
    }
  });
}
