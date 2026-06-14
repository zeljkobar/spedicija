import { prisma } from "../db.js";

export async function listCompanies(query = {}) {
  const search = query.search?.trim();
  return prisma.company.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { pib: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } }
          ]
        }
      : undefined,
    orderBy: { name: "asc" }
  });
}

export async function getCompany(id) {
  return prisma.company.findUnique({
    where: { id: Number(id) },
    include: { positions: true, invoices: true }
  });
}

export async function createCompany(data) {
  return prisma.company.create({
    data: {
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

export async function updateCompany(id, data) {
  return prisma.company.update({
    where: { id: Number(id) },
    data
  });
}

export async function deleteCompany(id) {
  const used = await prisma.invoice.count({ where: { companyId: Number(id) } });
  if (used > 0) {
    const error = new Error("Firma ima vezane fakture i ne moze se obrisati.");
    error.status = 409;
    throw error;
  }

  return prisma.company.delete({ where: { id: Number(id) } });
}
