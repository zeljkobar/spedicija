export function toNumber(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
