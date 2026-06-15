import { prisma } from "../db.js";
import { tenantWhere } from "../middleware/auth.js";

function decimalInput(value) {
  return value === "" || value === null || value === undefined ? 0 : value;
}

export async function listInvoices(query = {}, user) {
  return prisma.invoice.findMany({
    where: {
      ...(query.positionId ? { positionId: Number(query.positionId) } : {}),
      ...(query.invoiceType ? { invoiceType: query.invoiceType } : {}),
      position: tenantWhere(user)
    },
    include: { company: true, position: true },
    orderBy: { invoiceDate: "desc" }
  });
}

export async function createInvoice(data, user) {
  const positionId = Number(data.positionId);
  const companyId = Number(data.companyId);

  const position = await prisma.position.findFirst({ where: { id: positionId, ...tenantWhere(user) } });
  if (!position) {
    const error = new Error("Pozicija nije pronadjena.");
    error.status = 404;
    throw error;
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, organizationId: position.organizationId }
  });
  if (!company) {
    const error = new Error("Firma ne pripada izabranoj spediciji.");
    error.status = 400;
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

export async function updateInvoice(id, data, user) {
  const existing = await prisma.invoice.findFirst({
    where: { id: Number(id), position: tenantWhere(user) }
  });
  if (!existing) {
    const error = new Error("Faktura nije pronadjena.");
    error.status = 404;
    throw error;
  }

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

export async function deleteInvoice(id, user) {
  const existing = await prisma.invoice.findFirst({
    where: { id: Number(id), position: tenantWhere(user) }
  });
  if (!existing) {
    const error = new Error("Faktura nije pronadjena.");
    error.status = 404;
    throw error;
  }

  return prisma.invoice.delete({ where: { id: Number(id) } });
}
