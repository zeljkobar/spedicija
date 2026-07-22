import { prisma } from "../db.js";
import { tenantWhere } from "../middleware/auth.js";

const MODELS = {
  containerTypes: prisma.containerType,
  carriers: prisma.carrier,
  salesAgents: prisma.salesAgent
};

function modelFor(type) {
  const model = MODELS[type];
  if (!model) {
    const error = new Error("Nepoznat sifrarnik.");
    error.status = 404;
    throw error;
  }
  return model;
}

function organizationIdForCreate(data, user) {
  if (user?.role === "SUPER_ADMIN") return data.organizationId ? Number(data.organizationId) : null;
  return Number(user.organizationId);
}

export async function listLookup(type, query = {}, user) {
  const model = modelFor(type);
  return model.findMany({
    where: {
      ...tenantWhere(user),
      ...(query.organizationId && user?.role === "SUPER_ADMIN" ? { organizationId: Number(query.organizationId) } : {}),
      ...(query.active === "true" ? { active: true } : {}),
      ...(query.search ? { name: { contains: query.search.trim(), mode: "insensitive" } } : {})
    },
    include: {
      organization: { select: { id: true, name: true } }
    },
    orderBy: [{ active: "desc" }, { name: "asc" }]
  });
}

export async function createLookup(type, data, user) {
  const model = modelFor(type);
  const organizationId = organizationIdForCreate(data, user);
  if (!organizationId) {
    const error = new Error("Izaberi spediciju za sifrarnik.");
    error.status = 400;
    throw error;
  }

  return model.create({
    data: {
      organizationId,
      name: data.name.trim(),
      active: data.active ?? true,
      note: data.note || null
    }
  });
}

export async function updateLookup(type, id, data, user) {
  const model = modelFor(type);
  const existing = await model.findFirst({ where: { id: Number(id), ...tenantWhere(user) } });
  if (!existing) {
    const error = new Error("Stavka sifrarnika nije pronadjena.");
    error.status = 404;
    throw error;
  }

  const payload = { ...data };
  if (payload.name) payload.name = payload.name.trim();
  if (payload.organizationId) payload.organizationId = Number(payload.organizationId);
  if (payload.note === "") payload.note = null;

  return model.update({
    where: { id: Number(id) },
    data: payload
  });
}
