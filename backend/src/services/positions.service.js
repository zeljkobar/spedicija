import { prisma } from "../db.js";
import { tenantWhere } from "../middleware/auth.js";
import { buildFinancialSummary } from "../utils/financialSummary.js";
import { normalizeContainerNumber } from "../utils/normalizeContainerNumber.js";

const includeDetails = {
  company: true,
  invoices: { include: { company: true }, orderBy: { invoiceDate: "desc" } },
  additionalCosts: { orderBy: { costDate: "desc" } }
};

function organizationIdForCreate(data, user) {
  if (user?.role === "SUPER_ADMIN") return data.organizationId ? Number(data.organizationId) : null;
  return Number(user.organizationId);
}

export function withSummary(position) {
  if (!position) return null;
  return {
    ...position,
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
  const existing = await prisma.position.findFirst({ where: { containerNumber, organizationId } });

  if (existing) {
    const error = new Error("Pozicija sa ovim brojem kontejnera vec postoji.");
    error.status = 409;
    error.existingPositionId = existing.id;
    throw error;
  }

  return prisma.position.create({
    data: {
      containerNumber,
      organizationId,
      companyId: data.companyId ? Number(data.companyId) : null,
      title: data.title || null,
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
  if (payload.containerNumber) payload.containerNumber = normalizeContainerNumber(payload.containerNumber);
  if (payload.organizationId) payload.organizationId = Number(payload.organizationId);
  if (payload.companyId) payload.companyId = Number(payload.companyId);
  if (payload.openingDate) payload.openingDate = new Date(payload.openingDate);
  if (payload.closingDate) payload.closingDate = new Date(payload.closingDate);

  return prisma.position.update({
    where: { id: Number(id) },
    data: payload
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
