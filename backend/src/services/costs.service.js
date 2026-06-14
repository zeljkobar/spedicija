import { prisma } from "../db.js";

export async function listCosts(query = {}) {
  return prisma.additionalCost.findMany({
    where: query.positionId ? { positionId: Number(query.positionId) } : undefined,
    include: { position: true },
    orderBy: { costDate: "desc" }
  });
}

export async function createCost(data) {
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
