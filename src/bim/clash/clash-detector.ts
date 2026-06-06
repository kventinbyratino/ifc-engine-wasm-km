import * as THREE from "three";
import type { BimElementRecord } from "../data/element-index";
import { BBoxIndex, getCachedElementBoxes } from "../spatial/bbox-index";
import type { ModelIdMap } from "../types";
import type { ClashDetectionInput, ClashDetectionResult, ClashRecord, ElementBox } from "./clash-types";

export type FragmentsBBoxProvider = {
  getBBoxes(modelIdMap: ModelIdMap): Promise<THREE.Box3[]>;
};

export async function detectHardClashes(
  fragments: FragmentsBBoxProvider,
  input: ClashDetectionInput,
): Promise<ClashDetectionResult> {
  const groupA = input.groupA.slice(0, input.limit);
  const groupB = input.groupB.slice(0, input.limit);
  const bboxIndex = input.bboxIndex ?? new BBoxIndex();
  const boxesA = await getElementBoxes(fragments, groupA, bboxIndex);
  const boxesB = await getElementBoxes(fragments, groupB, bboxIndex);
  const clashes: ClashRecord[] = [];
  let checkedPairs = 0;
  let skippedPairs = 0;

  for (const itemA of boxesA) {
    for (const itemB of boxesB) {
      if (isSameElement(itemA.record, itemB.record)) {
        skippedPairs++;
        continue;
      }

      checkedPairs++;
      const overlap = getOverlapBox(itemA.box, itemB.box, input.tolerance);
      if (!overlap) continue;

      const overlapSize = overlap.getSize(new THREE.Vector3());
      const overlapVolume = overlapSize.x * overlapSize.y * overlapSize.z;
      clashes.push(createClashRecord(itemA.record, itemB.record, overlapVolume));
    }
  }

  clashes.sort((a, b) => b.overlapVolume - a.overlapVolume);
  return { clashes, checkedPairs, skippedPairs };
}

async function getElementBoxes(
  fragments: FragmentsBBoxProvider,
  records: BimElementRecord[],
  bboxIndex: BBoxIndex,
): Promise<ElementBox[]> {
  return getCachedElementBoxes({ index: bboxIndex, fragments, records });
}

function getOverlapBox(a: THREE.Box3, b: THREE.Box3, tolerance: number) {
  const aBox = a.clone().expandByScalar(tolerance);
  const bBox = b.clone().expandByScalar(tolerance);
  if (!aBox.intersectsBox(bBox)) return null;

  const min = new THREE.Vector3(
    Math.max(a.min.x, b.min.x),
    Math.max(a.min.y, b.min.y),
    Math.max(a.min.z, b.min.z),
  );
  const max = new THREE.Vector3(
    Math.min(a.max.x, b.max.x),
    Math.min(a.max.y, b.max.y),
    Math.min(a.max.z, b.max.z),
  );
  if (max.x < min.x || max.y < min.y || max.z < min.z) return null;
  return new THREE.Box3(min, max);
}

function createClashRecord(a: BimElementRecord, b: BimElementRecord, overlapVolume: number): ClashRecord {
  const id = `clash-${a.modelId}-${a.localId}-${b.modelId}-${b.localId}`;
  const severity = overlapVolume > 0.5 ? "critical" : overlapVolume > 0.05 ? "warning" : "info";
  return {
    id,
    title: `${a.category || "Element"} × ${b.category || "Element"}`,
    description: `${a.name || `#${a.localId}`} / ${b.name || `#${b.localId}`} · overlap ${formatVolume(overlapVolume)}`,
    severity,
    a,
    b,
    overlapVolume,
    modelIdMap: createClashModelIdMap(a, b),
  };
}

function createClashModelIdMap(a: BimElementRecord, b: BimElementRecord) {
  const modelIdMap: ModelIdMap = { [a.modelId]: new Set([a.localId]) };
  modelIdMap[b.modelId] ??= new Set<number>();
  modelIdMap[b.modelId].add(b.localId);
  return modelIdMap;
}

function isSameElement(a: BimElementRecord, b: BimElementRecord) {
  return a.modelId === b.modelId && a.localId === b.localId;
}

function formatVolume(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value >= 1) return `${value.toFixed(2)} m³`;
  return `${value.toFixed(4)} m³`;
}
