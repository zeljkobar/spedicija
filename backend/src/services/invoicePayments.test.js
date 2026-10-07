import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../db.js";
import { settleInvoiceBatch } from "./invoicePayments.service.js";

test("batch settlement validates balances and scope and commits atomically", async () => {
  const original = prisma.$transaction;
  let committed = [];
  const invoices = [
    { id: 1, amountWithVat: 120, paymentStatus: "DJELIMICNO_PLACENO", payments: [{ amount: 40 }] },
    { id: 2, amountWithoutVat: 50, paymentStatus: "NEPLACENO", payments: [] }
  ];
  prisma.$transaction = async (action, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    const staged = [];
    const result = await action({
      invoice: {
        findMany: async ({ where }) => {
          assert.deepEqual(where.position, { organizationId: 7 });
          return invoices.filter((invoice) => where.id.in.includes(invoice.id));
        },
        update: async ({ data }) => assert.equal(data.paymentStatus, "PLACENO")
      },
      invoicePayment: { create: async ({ data }) => staged.push(data) }
    });
    committed = staged;
    return result;
  };
  const user = { role: "ADMIN", organizationId: 7 };
  const data = { paymentDate: "2026-10-07", note: "Izvod 12", items: [
    { invoiceId: 1, remainingAmount: 80 }, { invoiceId: 2, remainingAmount: 50 }
  ] };
  try {
    assert.deepEqual(await settleInvoiceBatch(data, user), { count: 2, total: 130 });
    assert.deepEqual(committed.map((payment) => payment.amount), [80, 50]);
    assert.equal(committed[0].note, "Izvod 12");
    committed = [];
    await assert.rejects(settleInvoiceBatch({ ...data, items: [data.items[0], { invoiceId: 2, remainingAmount: 70 }] }, user), { status: 409 });
    assert.deepEqual(committed, []);
    await assert.rejects(settleInvoiceBatch({ ...data, items: [{ invoiceId: 999, remainingAmount: 50 }] }, user), { status: 409 });
    invoices[0].payments = [{ amount: 120 }];
    await assert.rejects(settleInvoiceBatch(data, user), { status: 409 });
    invoices[0].payments = [];
    invoices[0].paymentStatus = "STORNIRANO";
    await assert.rejects(settleInvoiceBatch(data, user), { status: 409 });
  } finally {
    prisma.$transaction = original;
  }
});
