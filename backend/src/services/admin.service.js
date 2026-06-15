import bcrypt from "bcryptjs";
import { prisma } from "../db.js";

export async function listOrganizations() {
  return prisma.organization.findMany({
    include: {
      users: {
        select: { id: true, name: true, email: true, role: true, active: true, organizationId: true },
        orderBy: { name: "asc" }
      },
      _count: { select: { companies: true, positions: true, users: true } }
    },
    orderBy: { name: "asc" }
  });
}

export async function createOrganization(data) {
  return prisma.organization.create({
    data: {
      name: data.name,
      pib: data.pib || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      email: data.email || null,
      phone: data.phone || null
    }
  });
}

export async function createWorker(data) {
  const organization = await prisma.organization.findUnique({ where: { id: Number(data.organizationId) } });
  if (!organization) {
    const error = new Error("Spedicija nije pronadjena.");
    error.status = 404;
    throw error;
  }

  return prisma.user.create({
    data: {
      organizationId: organization.id,
      name: data.name,
      email: data.email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(data.password, 10),
      role: data.role || "USER",
      active: data.active ?? true
    },
    select: { id: true, organizationId: true, name: true, email: true, role: true, active: true }
  });
}

export async function updateWorker(id, data) {
  const payload = { ...data };
  delete payload.password;

  if (payload.organizationId) payload.organizationId = Number(payload.organizationId);
  if (data.password) payload.passwordHash = await bcrypt.hash(data.password, 10);

  return prisma.user.update({
    where: { id: Number(id) },
    data: payload,
    select: { id: true, organizationId: true, name: true, email: true, role: true, active: true }
  });
}
