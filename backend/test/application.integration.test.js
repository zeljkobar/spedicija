import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

test("application integration against local PostgreSQL", { skip: process.env.RUN_DATABASE_TESTS !== "1" }, async (t) => {
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(url.hostname), "Only a local test database is allowed");
  const { prisma } = await import("../src/db.js");
  const { app } = await import("../src/app.js");
  const tag = `QA-${Date.now()}`;
  const password = "QaTest-password-2026";
  const orgIds = [];
  const userIds = [];
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let auth;
  async function api(path, method = "GET", body, expected = 200, token = auth) {
    const response = await fetch(base + path, { method, headers: {
      "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {})
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const result = response.status === 204 ? {} : await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
    return result;
  }
  try {
    const orgA = await prisma.organization.create({ data: { name: `${tag}-A` } });
    const orgB = await prisma.organization.create({ data: { name: `${tag}-B` } });
    orgIds.push(orgA.id, orgB.id);
    const hash = await bcrypt.hash(password, 10);
    const users = {};
    for (const [key, role, organizationId] of [["admin", "ADMIN", orgA.id], ["other", "ADMIN", orgB.id], ["viewer", "VIEWER", orgA.id], ["worker", "USER", orgA.id], ["super", "SUPER_ADMIN", null]]) {
      users[key] = await prisma.user.create({ data: { name: `${tag}-${key}`, email: `${tag}-${key}@example.test`.toLowerCase(), role, organizationId, passwordHash: hash } });
      userIds.push(users[key].id);
    }
    const tokens = {};
    for (const key of Object.keys(users)) {
      const result = await api("/auth/login", "POST", { email: users[key].email, password });
      tokens[key] = result.data.token;
    }
    auth = tokens.admin;
    await t.test("login, current user, bad credentials and unauthenticated access", async () => {
      assert.equal((await api("/auth/me")).data.id, users.admin.id);
      await api("/auth/login", "POST", { email: users.admin.email, password: "wrong" }, 401);
      await api("/positions", "GET", undefined, 401, null);
    });
    await t.test("password change and login with new password", async () => {
      await api("/auth/change-password", "POST", { currentPassword: "wrong", newPassword: "changed123" }, 400, tokens.worker);
      await api("/auth/change-password", "POST", { currentPassword: password, newPassword: "changed123" }, 200, tokens.worker);
      await api("/auth/login", "POST", { email: users.worker.email, password: "changed123" });
    });
    await t.test("admin and team permissions", async () => {
      await api("/admin/organizations", "GET", undefined, 403);
      await api("/admin/organizations", "GET", undefined, 200, tokens.super);
      await api("/team/workers", "GET", undefined, 403, tokens.worker);
      const team = (await api("/team/workers")).data;
      assert.ok(team.every((user) => user.organizationId === orgA.id && !user.passwordHash));
      const worker = (await api("/team/workers", "POST", { name: `${tag}-team`, email: `${tag}-team@example.test`, password, role: "USER" }, 201)).data;
      await api(`/team/workers/${worker.id}`, "PUT", { active: false });
      await api("/auth/login", "POST", { email: worker.email, password }, 401);
      await api(`/team/workers/${users.other.id}`, "PUT", { name: "not allowed" }, 403);
    });
    const company = (await api("/companies", "POST", { name: `${tag}-customer`, companyType: "KLIJENT" }, 201)).data;
    const otherCompany = (await api("/companies", "POST", { name: `${tag}-other` }, 201, tokens.other)).data;
    await t.test("company edit, search and tenant isolation", async () => {
      await api(`/companies/${company.id}`, "PUT", { note: "QA note" });
      assert.equal((await api(`/companies/${company.id}`)).data.note, "QA note");
      const rows = (await api(`/companies?search=${tag}`)).data;
      assert.deepEqual(rows.map((row) => row.id), [company.id]);
      await api(`/companies/${otherCompany.id}`, "GET", undefined, 404);
      await api(`/companies/${otherCompany.id}`, "DELETE", undefined, 404);
    });
    const refs = {};
    for (const type of ["containerTypes", "carriers", "salesAgents"]) {
      refs[type] = (await api(`/lookups/${type}`, "POST", { name: `${tag}-${type}` }, 201)).data;
      await t.test(`${type}: edit, active filter, tenant scope and permissions`, async () => {
        await api(`/lookups/${type}/${refs[type].id}`, "PUT", { active: false });
        assert.ok(!(await api(`/lookups/${type}?active=true`)).data.some((row) => row.id === refs[type].id));
        await api(`/lookups/${type}/${refs[type].id}`, "PUT", { active: true });
        await api(`/lookups/${type}`, "POST", { name: "denied" }, 403, tokens.worker);
        await api(`/lookups/${type}/${refs[type].id}`, "PUT", { name: "denied" }, 404, tokens.other);
      });
    }
    const positionData = { containerNumber: `${tag}-abc`, companyId: company.id, containerTypeId: refs.containerTypes.id, carrierId: refs.carriers.id, salesAgentId: refs.salesAgents.id, jci: "QA-JCI", openingDate: "2026-09-12", note: "QA position" };
    const position = (await api("/positions", "POST", positionData, 201)).data;
    const duplicate = (await api("/positions", "POST", { ...positionData, openingDate: "2026-08-15" }, 201)).data;
    await t.test("same container number allowed; position edit, search, sorting and details", async () => {
      assert.notEqual(position.id, duplicate.id);
      await api(`/positions/${position.id}`, "PUT", { note: "Updated", companyId: "" });
      assert.equal((await api(`/positions/${position.id}`)).data.companyId, null);
      await api(`/positions/${position.id}`, "PUT", { companyId: company.id });
      const rows = (await api(`/positions?search=${tag}`)).data;
      assert.deepEqual(rows.map((row) => row.id), [position.id, duplicate.id]);
      assert.equal(rows[0].containerNumber, positionData.containerNumber.toUpperCase());
      await api(`/positions/${position.id}`, "GET", undefined, 404, tokens.other);
    });
    for (const field of ["jci", "containerTypeId", "carrierId", "salesAgentId"]) await t.test(`position requires ${field}`, async () => {
      const data = { ...positionData };
      delete data[field];
      await api("/positions", "POST", data, 400);
    });
    await t.test("inactive lookup cannot be used for a new position", async () => {
      await api(`/lookups/carriers/${refs.carriers.id}`, "PUT", { active: false });
      try { await api("/positions", "POST", positionData, 400); }
      finally { await api(`/lookups/carriers/${refs.carriers.id}`, "PUT", { active: true }); }
    });
    const invoiceData = { positionId: position.id, companyId: company.id, invoiceType: "ULAZNA", invoiceNumber: `${tag}-IN`, invoiceDate: "2026-09-12", dueDate: "2026-09-30", amountWithoutVat: 100, amountWithVat: 121, vatAmount: 21 };
    const incoming = (await api("/invoices", "POST", invoiceData, 201)).invoice;
    const outgoing = (await api("/invoices", "POST", { ...invoiceData, invoiceType: "IZLAZNA", invoiceNumber: `${tag}-OUT`, amountWithoutVat: 300, amountWithVat: 363, vatAmount: 63 }, 201)).invoice;
    await t.test("duplicate invoice rejected, invoice edit and foreign company rejected", async () => {
      await api("/invoices", "POST", invoiceData, 409);
      await api(`/invoices/${incoming.id}`, "PUT", { description: "Edited", dueDate: "" });
      assert.equal((await api(`/invoices?positionId=${position.id}`)).data.find((row) => row.id === incoming.id).dueDate, null);
      await api("/invoices", "POST", { ...invoiceData, companyId: otherCompany.id }, 400);
      await api(`/invoices/${incoming.id}`, "DELETE", undefined, 404, tokens.other);
    });
    await t.test("additional costs and financial totals", async () => {
      await api("/costs", "POST", { positionId: position.id, description: "QA cost", costDate: "2026-09-13", amount: 20 }, 201);
      const details = (await api(`/positions/${position.id}`)).data;
      assert.equal(details.financial.totalRevenue, 300);
      assert.equal(details.financial.totalCosts, 120);
      assert.equal(details.financial.profit, 180);
      assert.equal(details.financial.margin, 60);
      assert.equal((await api(`/costs?positionId=${position.id}`, "GET", undefined, 200, tokens.other)).data.length, 0);
    });
    await t.test("individual partial payment, deletion and recalculated balance", async () => {
      const payment = (await api(`/invoices/${incoming.id}/payments`, "POST", { paymentDate: "2026-10-07", amount: 30 }, 201)).data;
      assert.equal((await api(`/invoices/${incoming.id}/payments`)).data.invoice.remainingAmount, 70);
      await api(`/invoice-payments/${payment.id}`, "DELETE", undefined, 204);
      assert.equal((await api(`/invoices/${incoming.id}/payments`)).data.invoice.remainingAmount, 100);
    });
    await t.test("real database bulk settlement and concurrent duplicate requests", async () => {
      const body = { paymentDate: "2026-10-07", items: [{ invoiceId: incoming.id, remainingAmount: 100 }, { invoiceId: outgoing.id, remainingAmount: 300 }] };
      const requests = await Promise.all([1, 2].map(() => fetch(base + "/invoice-payments/batch", { method: "POST", headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify(body) })));
      assert.deepEqual(requests.map((response) => response.status).sort(), [201, 409]);
      assert.equal(await prisma.invoicePayment.count({ where: { invoiceId: { in: [incoming.id, outgoing.id] } } }), 2);
      assert.equal((await api(`/invoices/${incoming.id}/payments`)).data.invoice.remainingAmount, 0);
    });
    for (const report of ["dashboard", "profit-by-container", "profit-by-company", "profit-by-period", "open-positions", "supplier-invoices", "customer-invoices"]) await t.test(`report ${report} and CSV`, async () => {
      const result = await api(`/reports/${report}?dateFrom=2026-09-01&dateTo=2026-09-30`);
      assert.ok(result.data);
      if (report !== "dashboard") {
        assert.ok(Array.isArray(result.data));
        const csv = await fetch(`${base}/reports/${report}?format=csv`, { headers: { Authorization: `Bearer ${auth}` } });
        assert.equal(csv.status, 200);
        assert.match(csv.headers.get("content-type"), /text\/csv/);
      }
    });
    await t.test("report period filtering and outstanding-only filter", async () => {
      const rows = (await api("/reports/profit-by-container?dateFrom=2026-09-01&dateTo=2026-09-30")).data;
      assert.deepEqual(rows.map((row) => row.positionId), [position.id]);
      assert.equal((await api("/reports/supplier-invoices?onlyDebt=true")).data.length, 0);
    });
    for (const [path, method, body] of [["/companies", "POST", { name: "denied" }], ["/positions", "POST", positionData], [`/positions/${position.id}`, "PUT", { note: "denied" }], [`/positions/${position.id}`, "DELETE"], ["/invoices", "POST", invoiceData], ["/costs", "POST", {}], [`/invoices/${incoming.id}/payments`, "POST", {}]]) await t.test(`viewer blocked: ${method} ${path}`, async () => {
      await api(path, method, body, 403, tokens.viewer);
    });
    await t.test("position rejects a company from another organization", async () => {
      await api("/positions", "POST", { ...positionData, companyId: otherCompany.id }, 400);
    });
    await t.test("company cannot be transferred to another tenant by ordinary admin", async () => {
      try { await api(`/companies/${company.id}`, "PUT", { organizationId: orgB.id }, 403); }
      finally { await prisma.company.update({ where: { id: company.id }, data: { organizationId: orgA.id } }); }
    });
    await t.test("lookup cannot be transferred to another tenant by ordinary admin", async () => {
      try { await api(`/lookups/carriers/${refs.carriers.id}`, "PUT", { organizationId: orgB.id }, 403); }
      finally { await prisma.carrier.update({ where: { id: refs.carriers.id }, data: { organizationId: orgA.id } }); }
    });
    await t.test("invoice edit rejects a foreign company", async () => {
      try { await api(`/invoices/${incoming.id}`, "PUT", { companyId: otherCompany.id }, 400); }
      finally { await prisma.invoice.update({ where: { id: incoming.id }, data: { companyId: company.id } }); }
    });
    await t.test("negative individual payment is rejected", async () => {
      await api(`/invoices/${incoming.id}/payments`, "POST", { paymentDate: "2026-10-07", amount: -5 }, 400);
    });
    await t.test("deactivated user cannot continue with an old token", async () => {
      await prisma.user.update({ where: { id: users.worker.id }, data: { active: false } });
      await api("/positions", "GET", undefined, 401, tokens.worker);
    });
    await t.test("close position and remove it from open report", async () => {
      await api(`/positions/${position.id}/close`, "POST");
      assert.equal((await api(`/positions/${position.id}`)).data.status, "ZATVORENA");
      assert.ok(!(await api("/reports/open-positions")).data.some((row) => row.positionId === position.id));
    });
    await t.test("used company is protected; position deletion removes related records", async () => {
      await api(`/companies/${company.id}`, "DELETE", undefined, 409);
      await api(`/positions/${position.id}`, "DELETE", undefined, 204);
      assert.equal(await prisma.invoice.count({ where: { positionId: position.id } }), 0);
      assert.equal(await prisma.additionalCost.count({ where: { positionId: position.id } }), 0);
      assert.equal(await prisma.invoicePayment.count({ where: { invoiceId: incoming.id } }), 0);
      await api(`/positions/${position.id}`, "GET", undefined, 404);
      const unused = (await api("/companies", "POST", { name: `${tag}-delete` }, 201)).data;
      await api(`/companies/${unused.id}`, "DELETE", undefined, 204);
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    // Only records belonging to the organizations created by this run are removed.
    await prisma.$transaction(async (tx) => {
      const positionWhere = { organizationId: { in: orgIds } };
      await tx.invoicePayment.deleteMany({ where: { invoice: { position: positionWhere } } });
      await tx.invoice.deleteMany({ where: { position: positionWhere } });
      await tx.additionalCost.deleteMany({ where: { position: positionWhere } });
      await tx.position.deleteMany({ where: positionWhere });
      for (const model of ["company", "containerType", "carrier", "salesAgent"]) await tx[model].deleteMany({ where: positionWhere });
      await tx.user.deleteMany({ where: { OR: [{ organizationId: { in: orgIds } }, { id: { in: userIds } }] } });
      await tx.organization.deleteMany({ where: { id: { in: orgIds } } });
    });
    await prisma.$disconnect();
  }
});
