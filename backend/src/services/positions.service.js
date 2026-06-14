import { prisma } from "../db.js";
import { buildFinancialSummary } from "../utils/financialSummary.js";
import { normalizeContainerNumber } from "../utils/normalizeContainerNumber.js";

const includeDetails = {
  company: true,
  invoices: { include: { company: true }, orderBy: { invoiceDate: "desc" } },
  additionalCosts: { orderBy: { costDate: "desc" } }
};

export function withSummary(position) {
  if (!position) return null;
  return {
    ...position,
    financial: buildFinancialSummary(position)
  };
}

export async function listPositions(query = {}) {
  const search = query.search?.trim();
  const status = query.status?.trim();
  const positions = await prisma.position.findMany({
    where: {
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

export async function getPosition(id) {
  const position = await prisma.position.findUnique({
    where: { id: Number(id) },
    include: includeDetails
  });
  return withSummary(position);
}

export async function getPositionByContainer(containerNumber) {
  const normalized = normalizeContainerNumber(containerNumber);
  const position = await prisma.position.findUnique({
    where: { containerNumber: normalized },
    include: includeDetails
  });
  return withSummary(position);
}

export async function createPosition(data) {
  const containerNumber = normalizeContainerNumber(data.containerNumber);
  const existing = await prisma.position.findUnique({ where: { containerNumber } });

  if (existing) {
    const error = new Error("Pozicija sa ovim brojem kontejnera vec postoji.");
    error.status = 409;
    error.existingPositionId = existing.id;
    throw error;
  }

  return prisma.position.create({
    data: {
      containerNumber,
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

export async function updatePosition(id, data) {
  const payload = { ...data };
  if (payload.containerNumber) payload.containerNumber = normalizeContainerNumber(payload.containerNumber);
  if (payload.companyId) payload.companyId = Number(payload.companyId);
  if (payload.openingDate) payload.openingDate = new Date(payload.openingDate);
  if (payload.closingDate) payload.closingDate = new Date(payload.closingDate);

  return prisma.position.update({
    where: { id: Number(id) },
    data: payload
  });
}

export async function closePosition(id) {
  return prisma.position.update({
    where: { id: Number(id) },
    data: {
      status: "ZATVORENA",
      closingDate: new Date()
    }
  });
}
