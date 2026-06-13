import type { BimElementRecord } from "../data/element-index";
import type { ModelIdMap } from "../types";
import type { ClashRecord, ClashSeverity } from "./clash-types";

export function createClashRecord(a: BimElementRecord, b: BimElementRecord, overlapVolume: number): ClashRecord {
  const id = createClashId(a, b);
  return {
    id,
    title: `${a.category || "Element"} × ${b.category || "Element"}`,
    description: `${a.name || `#${a.localId}`} / ${b.name || `#${b.localId}`} · overlap ${formatVolume(overlapVolume)}`,
    severity: getClashSeverity(overlapVolume),
    a,
    b,
    overlapVolume,
    modelIdMap: createClashModelIdMap(a, b),
  };
}

export function sortClashRecords(clashes: ClashRecord[]) {
  return [...clashes].sort((left, right) => right.overlapVolume - left.overlapVolume);
}

export function getClashSeverity(overlapVolume: number): ClashSeverity {
  return overlapVolume > 0.5 ? "critical" : overlapVolume > 0.05 ? "warning" : "info";
}

export function createClashId(a: BimElementRecord, b: BimElementRecord) {
  return `clash-${a.modelId}-${a.localId}-${b.modelId}-${b.localId}`;
}

export function createClashModelIdMap(a: BimElementRecord, b: BimElementRecord) {
  const modelIdMap: ModelIdMap = { [a.modelId]: new Set([a.localId]) };
  modelIdMap[b.modelId] ??= new Set<number>();
  modelIdMap[b.modelId].add(b.localId);
  return modelIdMap;
}

export function isSameElement(a: BimElementRecord, b: BimElementRecord) {
  return a.modelId === b.modelId && a.localId === b.localId;
}

export function formatVolume(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1) return `${value.toFixed(2)} m³`;
  return `${value.toFixed(4)} m³`;
}
