import { prisma } from "../db.js";
import { tenantWhere } from "../middleware/auth.js";

function organizationIdForCreate(data, user) {
  if (user?.role === "SUPER_ADMIN") return data.organizationId ? Number(data.organizationId) : null;
  return Number(user.organizationId);
}

export async function listCompanies(query = {}, user) {
  const search = query.search?.trim();
  return prisma.company.findMany({
    where: {
      ...tenantWhere(user),
      ...(query.organizationId && user?.role === "SUPER_ADMIN" ? { organizationId: Number(query.organizationId) } : {}),
      ...(search
        ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { pib: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
          ]
        }
        : {})
    },
    orderBy: { name: "asc" }
  });
}

export async function getCompany(id, user) {
  return prisma.company.findUnique({
    where: { id: Number(id), ...tenantWhere(user) },
    include: { positions: true, invoices: true }
  });
}

export async function createCompany(data, user) {
  const organizationId = organizationIdForCreate(data, user);
  if (!organizationId) {
    const error = new Error("Izaberi spediciju za firmu.");
    error.status = 400;
    throw error;
  }

  return prisma.company.create({
    data: {
      organizationId,
      name: data.name,
      pib: data.pib || null,
      vatNumber: data.vatNumber || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      companyType: data.companyType || "OSTALO",
      note: data.note || null
    }
  });
}

export async function updateCompany(id, data, user) {
  const existing = await prisma.company.findFirst({ where: { id: Number(id), ...tenantWhere(user) } });
  if (!existing) {
    const error = new Error("Firma nije pronadjena.");
    error.status = 404;
    throw error;
  }

  const payload = { ...data };
  if (payload.organizationId) payload.organizationId = Number(payload.organizationId);

  return prisma.company.update({
    where: { id: Number(id) },
    data: payload
  });
}

export async function deleteCompany(id, user) {
  const company = await prisma.company.findFirst({ where: { id: Number(id), ...tenantWhere(user) } });
  if (!company) {
    const error = new Error("Firma nije pronadjena.");
    error.status = 404;
    throw error;
  }

  const used = await prisma.invoice.count({ where: { companyId: Number(id) } });
  if (used > 0) {
    const error = new Error("Firma ima vezane fakture i ne moze se obrisati.");
    error.status = 409;
    throw error;
  }

  return prisma.company.delete({ where: { id: Number(id) } });
}
