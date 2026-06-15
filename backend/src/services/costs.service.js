import { prisma } from "../db.js";
import { tenantWhere } from "../middleware/auth.js";

export async function listCosts(query = {}, user) {
  return prisma.additionalCost.findMany({
    where: {
      ...(query.positionId ? { positionId: Number(query.positionId) } : {}),
      position: tenantWhere(user)
    },
    include: { position: true },
    orderBy: { costDate: "desc" }
  });
}

export async function createCost(data, user) {
  const position = await prisma.position.findFirst({
    where: { id: Number(data.positionId), ...tenantWhere(user) }
  });
  if (!position) {
    const error = new Error("Pozicija nije pronadjena.");
    error.status = 404;
    throw error;
  }

  return prisma.additionalCost.create({
    data: {
      positionId: Number(data.positionId),
      description: data.description,
      costDate: new Date(data.costDate),
      amount: data.amount || 0,
      currency: data.currency || "EUR",
      note: data.note || null
    }
  });
}
