import { prisma } from "../db.js";

function decimalInput(value) {
  return value === "" || value === null || value === undefined ? 0 : value;
}

export async function listInvoices(query = {}) {
  return prisma.invoice.findMany({
    where: {
      ...(query.positionId ? { positionId: Number(query.positionId) } : {}),
      ...(query.invoiceType ? { invoiceType: query.invoiceType } : {})
    },
    include: { company: true, position: true },
    orderBy: { invoiceDate: "desc" }
  });
}

export async function createInvoice(data) {
  const positionId = Number(data.positionId);
  const companyId = Number(data.companyId);

  const position = await prisma.position.findUnique({ where: { id: positionId } });
  if (!position) {
    const error = new Error("Pozicija nije pronadjena.");
    error.status = 404;
    throw error;
  }

  const duplicate = await prisma.invoice.findFirst({
    where: {
      positionId,
      invoiceNumber: data.invoiceNumber,
      companyId,
      invoiceType: data.invoiceType,
      invoiceDate: new Date(data.invoiceDate),
      amountWithoutVat: decimalInput(data.amountWithoutVat),
      vatAmount: decimalInput(data.vatAmount),
      amountWithVat: decimalInput(data.amountWithVat)
    }
  });

  if (duplicate) {
    const error = new Error("Ova faktura je vec unesena za izabranu poziciju.");
    error.status = 409;
    throw error;
  }

  const invoice = await prisma.invoice.create({
    data: {
      positionId,
      companyId,
      invoiceType: data.invoiceType,
      invoiceNumber: data.invoiceNumber,
      invoiceDate: new Date(data.invoiceDate),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      description: data.description || null,
      amountWithoutVat: decimalInput(data.amountWithoutVat),
      vatAmount: decimalInput(data.vatAmount),
      amountWithVat: decimalInput(data.amountWithVat),
      currency: data.currency || "EUR",
      paymentStatus: data.paymentStatus || "NEPLACENO",
      note: data.note || null
    },
    include: { company: true, position: true }
  });

  return { invoice };
}

export async function updateInvoice(id, data) {
  const payload = { ...data };
  if (payload.companyId) payload.companyId = Number(payload.companyId);
  if (payload.positionId) payload.positionId = Number(payload.positionId);
  if (payload.invoiceDate) payload.invoiceDate = new Date(payload.invoiceDate);
  if (payload.dueDate) payload.dueDate = new Date(payload.dueDate);
  if (payload.dueDate === "") payload.dueDate = null;
  if ("amountWithoutVat" in payload) payload.amountWithoutVat = decimalInput(payload.amountWithoutVat);
  if ("vatAmount" in payload) payload.vatAmount = decimalInput(payload.vatAmount);
  if ("amountWithVat" in payload) payload.amountWithVat = decimalInput(payload.amountWithVat);

  return prisma.invoice.update({
    where: { id: Number(id) },
    data: payload
  });
}

export async function deleteInvoice(id) {
  return prisma.invoice.delete({ where: { id: Number(id) } });
}
