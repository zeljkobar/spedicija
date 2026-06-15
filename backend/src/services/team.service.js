import bcrypt from "bcryptjs";
import { prisma } from "../db.js";

const workerSelect = {
  id: true,
  organizationId: true,
  name: true,
  email: true,
  role: true,
  active: true,
  createdAt: true
};

function organizationIdForAdmin(user, requestedOrganizationId) {
  if (user?.role === "SUPER_ADMIN") return requestedOrganizationId ? Number(requestedOrganizationId) : null;
  return Number(user.organizationId);
}

export async function listTeam(user, query = {}) {
  const organizationId = organizationIdForAdmin(user, query.organizationId);
  if (!organizationId) {
    const error = new Error("Izaberi spediciju.");
    error.status = 400;
    throw error;
  }

  return prisma.user.findMany({
    where: {
      organizationId,
      role: { not: "SUPER_ADMIN" }
    },
    select: workerSelect,
    orderBy: { name: "asc" }
  });
}

export async function createTeamWorker(user, data) {
  const organizationId = organizationIdForAdmin(user, data.organizationId);
  if (!organizationId) {
    const error = new Error("Izaberi spediciju.");
    error.status = 400;
    throw error;
  }

  if (data.role === "SUPER_ADMIN") {
    const error = new Error("Ne mozes kreirati super admina.");
    error.status = 403;
    throw error;
  }

  return prisma.user.create({
    data: {
      organizationId,
      name: data.name,
      email: data.email.trim().toLowerCase(),
      passwordHash: await bcrypt.hash(data.password, 10),
      role: data.role || "USER",
      active: data.active ?? true
    },
    select: workerSelect
  });
}

export async function updateTeamWorker(user, id, data) {
  const existing = await prisma.user.findUnique({ where: { id: Number(id) } });
  if (!existing || existing.role === "SUPER_ADMIN") {
    const error = new Error("Radnik nije pronadjen.");
    error.status = 404;
    throw error;
  }

  if (user.role !== "SUPER_ADMIN" && existing.organizationId !== Number(user.organizationId)) {
    const error = new Error("Nemate pristup ovom radniku.");
    error.status = 403;
    throw error;
  }

  if (data.role === "SUPER_ADMIN") {
    const error = new Error("Ne mozes dodijeliti super admin rolu.");
    error.status = 403;
    throw error;
  }

  const payload = { ...data };
  delete payload.password;
  delete payload.organizationId;
  if (data.password) payload.passwordHash = await bcrypt.hash(data.password, 10);

  return prisma.user.update({
    where: { id: Number(id) },
    data: payload,
    select: workerSelect
  });
}
