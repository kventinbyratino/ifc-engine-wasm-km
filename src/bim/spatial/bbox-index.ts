import * as THREE from "three";
import type { BimElementRecord } from "../data/element-index";
import type { ModelIdMap } from "../types";

export type BBoxIndexRecord = {
  modelId: string;
  localId: number;
  box: THREE.Box3;
};

export type BBoxIndexProvider = {
  getBBoxes(modelIdMap: ModelIdMap): Promise<THREE.Box3[]>;
};

export function bboxKey(modelId: string, localId: number) {
  return `${modelId}:${localId}`;
}

export class BBoxIndex {
  private readonly records = new Map<string, BBoxIndexRecord>();

  get(modelId: string, localId: number) {
    const record = this.records.get(bboxKey(modelId, localId));
    return record ? { ...record, box: record.box.clone() } : null;
  }

  set(record: BBoxIndexRecord) {
    this.records.set(bboxKey(record.modelId, record.localId), {
      ...record,
      box: record.box.clone(),
    });
  }

  delete(modelId: string, localId: number) {
    this.records.delete(bboxKey(modelId, localId));
  }

  clear() {
    this.records.clear();
  }

  clearModel(modelId: string) {
    const prefix = `${modelId}:`;
    for (const key of this.records.keys()) {
      if (key.startsWith(prefix)) this.records.delete(key);
    }
  }

  size() {
    return this.records.size;
  }
}

export async function getCachedElementBox(
  index: BBoxIndex,
  fragments: BBoxIndexProvider,
  record: BimElementRecord,
) {
  const cached = index.get(record.modelId, record.localId);
  if (cached) return cached.box;

  const boxes = await fragments.getBBoxes({ [record.modelId]: new Set([record.localId]) });
  const box = unionBoxes(boxes);
  if (!box.isEmpty()) index.set({ modelId: record.modelId, localId: record.localId, box });
  return box;
}

function unionBoxes(boxes: THREE.Box3[]) {
  const result = new THREE.Box3();
  for (const box of boxes) result.union(box);
  return result;
}
