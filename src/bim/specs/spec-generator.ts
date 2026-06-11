import type { BimElementRecord } from "../data/element-index";

export type SpecificationRow = {
  category: string;
  storey: string;
  count: number;
};

export function generateSpecification(records: BimElementRecord[]) {
  const map = new Map<string, SpecificationRow>();
  for (const record of records) {
    const category = record.category || "IfcElement";
    const storey = record.storey || "Без этажа";
    const key = `${category}\u0000${storey}`;
    const row = map.get(key) ?? { category, storey, count: 0 };
    row.count += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category, "ru") || a.storey.localeCompare(b.storey, "ru"));
}

export function specificationToCsv(rows: SpecificationRow[]) {
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return [["IFC-класс", "Этаж", "Количество"], ...rows.map((row) => [row.category, row.storey, row.count])]
    .map((row) => row.map(escape).join(","))
    .join("\n");
}
