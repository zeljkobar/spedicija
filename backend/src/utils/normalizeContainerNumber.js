export function normalizeContainerNumber(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}
