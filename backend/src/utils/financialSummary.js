import { toNumber, roundMoney } from "./money.js";

function accountingAmount(invoice) {
  const withoutVat = toNumber(invoice.amountWithoutVat);
  return withoutVat > 0 ? withoutVat : toNumber(invoice.amountWithVat);
}

export function buildFinancialSummary(position) {
  const invoices = position.invoices || [];
  const additionalCosts = position.additionalCosts || [];

  const totalRevenue = invoices
    .filter((invoice) => invoice.invoiceType === "IZLAZNA")
    .reduce((sum, invoice) => sum + accountingAmount(invoice), 0);

  const invoiceCosts = invoices
    .filter((invoice) => invoice.invoiceType === "ULAZNA")
    .reduce((sum, invoice) => sum + accountingAmount(invoice), 0);

  const directCosts = additionalCosts.reduce((sum, cost) => sum + toNumber(cost.amount), 0);
  const totalCosts = invoiceCosts + directCosts;
  const profit = totalRevenue - totalCosts;
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

  return {
    totalRevenue: roundMoney(totalRevenue),
    totalCosts: roundMoney(totalCosts),
    profit: roundMoney(profit),
    margin: roundMoney(margin)
  };
}
