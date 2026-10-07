import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { app } from "../src/app.js";
import { prisma } from "../src/db.js";
import { signUserToken } from "../src/middleware/auth.js";

// Exercise the real HTTP routes with an isolated, rollback-capable database substitute.
test("KIF/KUF payment API", async (t) => {
  const originalTransaction = prisma.$transaction;
  const originalFindMany = prisma.invoice.findMany;
  const originalUserFind = prisma.user.findUnique;
  prisma.user.findUnique = async ({ where }) => ({ id: where.id, active: true, role: where.id === 2 ? "VIEWER" : where.id === 3 ? "SUPER_ADMIN" : "ADMIN", organizationId: 7 });
  let invoices;
  let failWrite;
  let conflict;
  let databaseCalls = 0;
  const makeInvoice = (id, extra = {}) => ({
    id, invoiceNumber: `TEST-${id}`, invoiceType: "ULAZNA", amountWithoutVat: 0,
    amountWithVat: 100, paymentStatus: "NEPLACENO", payments: [],
    companyId: 1, company: { name: "Test firma" }, invoiceDate: new Date("2026-09-12"),
    position: { organizationId: 7, containerNumber: "TEST123", status: "OTVORENA" }, ...extra
  });
  function reset() {
    invoices = [makeInvoice(1), makeInvoice(2, { payments: [{ amount: 25 }] })];
    failWrite = false;
    conflict = false;
    databaseCalls = 0;
  }
  const scoped = (rows, where) => rows.filter((row) =>
    (!where.id || where.id.in.includes(row.id)) &&
    (!where.position.organizationId || row.position.organizationId === where.position.organizationId) &&
    (!where.invoiceType || row.invoiceType === where.invoiceType)
  );
  prisma.$transaction = async (callback) => {
    databaseCalls++;
    if (conflict) throw Object.assign(new Error("Conflict"), { code: "P2034" });
    const staged = structuredClone(invoices);
    const result = await callback({
      invoice: {
        findMany: async ({ where }) => scoped(staged, where),
        update: async ({ where, data }) => Object.assign(staged.find((row) => row.id === where.id), data)
      },
      invoicePayment: { create: async ({ data }) => {
        if (failWrite && data.invoiceId === 2) throw new Error("Simulated write failure");
        staged.find((row) => row.id === data.invoiceId).payments.push(data);
        return data;
      } }
    });
    invoices = staged;
    return result;
  };
  prisma.invoice.findMany = async ({ where }) => scoped(invoices, where);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = (role = "ADMIN") => signUserToken({ id: role === "VIEWER" ? 2 : role === "SUPER_ADMIN" ? 3 : 1, role, organizationId: 7 });
  const body = () => ({ paymentDate: "2026-10-07", method: "ZIRO_RACUN", note: "Izvod 12", items: [
    { invoiceId: 1, remainingAmount: 100 }, { invoiceId: 2, remainingAmount: 75 }
  ] });
  const post = (data = body(), auth = token()) => fetch(`${base}/invoice-payments/batch`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(data)
  });
  try {
    await t.test("requires authentication", async () => {
      reset();
      assert.equal((await post(body(), null)).status, 401);
      assert.equal(databaseCalls, 0);
    });
    await t.test("viewer cannot pay", async () => {
      reset();
      assert.equal((await post(body(), token("VIEWER"))).status, 403);
      assert.equal(databaseCalls, 0);
    });
    const invalid = [
      ["empty selection", { items: [] }],
      ["duplicate IDs", { items: [{ invoiceId: 1, remainingAmount: 100 }, { invoiceId: 1, remainingAmount: 100 }] }],
      ["invalid date", { paymentDate: "2026-02-30" }],
      ["missing date", { paymentDate: undefined }],
      ["invalid method", { method: "INVALID" }],
      ["negative amount", { items: [{ invoiceId: 1, remainingAmount: -1 }] }],
      ["zero amount", { items: [{ invoiceId: 1, remainingAmount: 0 }] }],
      ["invalid ID", { items: [{ invoiceId: -1, remainingAmount: 100 }] }],
      ["over 500 invoices", { items: Array.from({ length: 501 }, (_, i) => ({ invoiceId: i + 1, remainingAmount: 100 })) }]
    ];
    for (const [name, override] of invalid) await t.test(`rejects ${name}`, async () => {
      reset();
      assert.equal((await post({ ...body(), ...override })).status, 400);
      assert.equal(databaseCalls, 0);
    });
    await t.test("settles only outstanding balances and rejects repeat submission", async () => {
      reset();
      const result = await post();
      assert.equal(result.status, 201);
      assert.deepEqual((await result.json()).data, { count: 2, total: 175 });
      assert.deepEqual(invoices.map((row) => row.paymentStatus), ["PLACENO", "PLACENO"]);
      assert.equal(invoices[1].payments[1].amount, 75);
      assert.equal(invoices[1].payments[1].note, "Izvod 12");
      assert.equal(invoices[1].payments[1].paymentDate.toISOString(), "2026-10-07T00:00:00.000Z");
      assert.equal((await post()).status, 409);
      assert.deepEqual(invoices.map((row) => row.payments.length), [1, 2]);
    });
    await t.test("pays 20 invoices in one request with exact cent totals", async () => {
      reset();
      invoices = Array.from({ length: 20 }, (_, i) => makeInvoice(i + 1, {
        amountWithVat: 10.30, payments: [{ amount: 0.10 }]
      }));
      const result = await post({ ...body(), items: invoices.map((row) => ({ invoiceId: row.id, remainingAmount: 10.20 })) });
      assert.equal(result.status, 201);
      assert.deepEqual((await result.json()).data, { count: 20, total: 204 });
      assert.ok(invoices.every((row) => row.paymentStatus === "PLACENO" && row.payments.length === 2 && row.payments[1].amount === 10.20));
    });
    await t.test("super admin can settle accounts across organizations", async () => {
      reset();
      invoices[1].position.organizationId = 8;
      assert.equal((await post(body(), token("SUPER_ADMIN"))).status, 201);
    });
    for (const state of ["foreign", "missing", "stale", "cancelled", "paid"]) await t.test(`rejects ${state} invoice without partial payment`, async () => {
      reset();
      if (state === "foreign") invoices[1].position.organizationId = 8;
      if (state === "missing") invoices.pop();
      if (state === "stale") invoices[1].payments.push({ amount: 1 });
      if (state === "cancelled") invoices[1].paymentStatus = "STORNIRANO";
      if (state === "paid") invoices[1].payments.push({ amount: 75 });
      const before = structuredClone(invoices);
      assert.equal((await post()).status, 409);
      assert.deepEqual(invoices, before);
    });
    await t.test("database write failure rolls back the batch", async () => {
      reset();
      failWrite = true;
      const before = structuredClone(invoices);
      assert.equal((await post()).status, 500);
      assert.deepEqual(invoices, before);
    });
    await t.test("concurrent change returns a retryable conflict", async () => {
      reset();
      conflict = true;
      assert.equal((await post()).status, 409);
      assert.equal(invoices[0].payments.length, 0);
    });
    for (const [path, type] of [["supplier-invoices", "ULAZNA"], ["customer-invoices", "IZLAZNA"]]) {
      await t.test(`${path}: debt filter applies to JSON and CSV`, async () => {
        reset();
        invoices = [
          makeInvoice(1, { invoiceType: type }),
          makeInvoice(2, { invoiceType: type, payments: [{ amount: 100 }] }),
          makeInvoice(3, { invoiceType: type, paymentStatus: "STORNIRANO" }),
          makeInvoice(4, { invoiceType: type, amountWithVat: 0 })
        ];
        const headers = { Authorization: `Bearer ${token()}` };
        const all = await fetch(`${base}/reports/${path}`, { headers });
        assert.equal((await all.json()).data.length, 4);
        const filtered = await fetch(`${base}/reports/${path}?onlyDebt=true`, { headers });
        assert.deepEqual((await filtered.json()).data.map((row) => row.invoiceId), [1]);
        const csv = await fetch(`${base}/reports/${path}?onlyDebt=true&format=csv`, { headers });
        assert.match(csv.headers.get("content-type"), /text\/csv/);
        const text = await csv.text();
        assert.match(text, /TEST-1/);
        assert.doesNotMatch(text, /TEST-[234]/);
      });
    }
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    prisma.$transaction = originalTransaction;
    prisma.invoice.findMany = originalFindMany;
    prisma.user.findUnique = originalUserFind;
  }
});
