import type { BimElementRecord, ElementIndexFilters } from "./element-index";

export function buildSearchableIndex(parts: Array<string | number | boolean>) {
  return parts.map((part) => String(part)).join(" ").toLocaleLowerCase();
}

export function normalizeElementIndexQuery(filters: ElementIndexFilters) {
  return {
    query: filters.query.trim().toLocaleLowerCase(),
    category: filters.category.trim(),
    storey: filters.storey.trim(),
  };
}

export function matchesElementRecord(record: BimElementRecord, filters: ElementIndexFilters) {
  const normalized = normalizeElementIndexQuery(filters);
  if (normalized.category && record.category !== normalized.category) return false;
  if (normalized.storey && record.storey !== normalized.storey) return false;
  if (normalized.query && !record.searchable.includes(normalized.query)) return false;
  return true;
}
