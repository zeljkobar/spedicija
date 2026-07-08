import { prisma } from "../db.js";
import { tenantWhere } from "../middleware/auth.js";
import { roundMoney, toNumber } from "../utils/money.js";

function decimalInput(value) {
  return value === "" || value === null || value === undefined ? 0 : value;
}

function invoiceAmount(invoice) {
  const withoutVat = toNumber(invoice.amountWithoutVat);
  return withoutVat > 0 ? withoutVat : toNumber(invoice.amountWithVat);
}

export function paymentSummary(invoice) {
  const totalAmount = roundMoney(invoiceAmount(invoice));
  const paidAmount = roundMoney((invoice.payments || []).reduce((sum, payment) => sum + toNumber(payment.amount), 0));
  const remainingAmount = roundMoney(Math.max(totalAmount - paidAmount, 0));
  let computedPaymentStatus = "NEPLACENO";

  if (invoice.paymentStatus === "STORNIRANO") {
    computedPaymentStatus = "STORNIRANO";
  } else if (paidAmount >= totalAmount && totalAmount > 0) {
    computedPaymentStatus = "PLACENO";
  } else if (paidAmount > 0) {
    computedPaymentStatus = "DJELIMICNO_PLACENO";
  }

  return {
    totalAmount,
    paidAmount,
    remainingAmount,
    computedPaymentStatus
  };
}

async function getScopedInvoice(id, user) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: Number(id), position: tenantWhere(user) },
    include: {
      company: true,
      position: true,
      payments: { orderBy: { paymentDate: "desc" } }
    }
  });

  if (!invoice) {
    const error = new Error("Faktura nije pronadjena.");
    error.status = 404;
    throw error;
  }

  return invoice;
}

async function syncInvoicePaymentStatus(invoiceId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(invoiceId) },
    include: { payments: true }
  });

  if (!invoice || invoice.paymentStatus === "STORNIRANO") return invoice;

  const { computedPaymentStatus } = paymentSummary(invoice);
  return prisma.invoice.update({
    where: { id: invoice.id },
    data: { paymentStatus: computedPaymentStatus }
  });
}

export async function listInvoicePayments(invoiceId, user) {
  const invoice = await getScopedInvoice(invoiceId, user);
  return {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      company: invoice.company?.name || "",
      containerNumber: invoice.position?.containerNumber || "",
      ...paymentSummary(invoice)
    },
    payments: invoice.payments.map((payment) => ({
      id: payment.id,
      invoiceId: payment.invoiceId,
      paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      amount: roundMoney(payment.amount),
      method: payment.method,
      note: payment.note || ""
    }))
  };
}

export async function createInvoicePayment(invoiceId, data, user) {
  await getScopedInvoice(invoiceId, user);

  const payment = await prisma.invoicePayment.create({
    data: {
      invoiceId: Number(invoiceId),
      paymentDate: new Date(data.paymentDate),
      amount: decimalInput(data.amount),
      method: data.method || "ZIRO_RACUN",
      note: data.note || null
    }
  });

  await syncInvoicePaymentStatus(invoiceId);
  return payment;
}

export async function deleteInvoicePayment(id, user) {
  const payment = await prisma.invoicePayment.findFirst({
    where: { id: Number(id), invoice: { position: tenantWhere(user) } }
  });

  if (!payment) {
    const error = new Error("Placanje nije pronadjeno.");
    error.status = 404;
    throw error;
  }

  await prisma.invoicePayment.delete({ where: { id: payment.id } });
  await syncInvoicePaymentStatus(payment.invoiceId);
  return true;
}
