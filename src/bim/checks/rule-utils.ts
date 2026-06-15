import type { BimElementRecord } from "../data/element-index.ts";

const NON_BUILDING_CATEGORIES = new Set(["IFCBUILDINGSTOREY", "IFCPROJECT", "IFCSITE", "IFCBUILDING"]);

export function isBuildingElement(record: BimElementRecord) {
  return record.category.startsWith("IFC") && !NON_BUILDING_CATEGORIES.has(record.category);
}

export function hasMaterial(record: BimElementRecord) {
  return Boolean(record.materialName || record.searchable.includes("ifcmaterial") || record.searchable.includes("material"));
}
