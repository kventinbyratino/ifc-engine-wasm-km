import type { ModelIdMap } from "../types.ts";

export type Vec3 = [number, number, number];

export type VisibilityBox = {
  min: Vec3;
  max: Vec3;
};

export type VisibilityChunk = {
  chunkId: string;
  modelId: string;
  localIds: number[];
  box: VisibilityBox;
};

export type VisibilityCameraQuery = {
  position: Vec3;
  target: Vec3;
  maxDistance: number;
};

export type VisibilityQueryResult = {
  chunkIds: string[];
  modelIdMap: ModelIdMap;
  visibleElementCount: number;
};

export function createVisibilityIndex(chunks: VisibilityChunk[]) {
  const normalized = chunks.map((chunk) => ({ ...chunk, localIds: [...new Set(chunk.localIds)] }));
  return {
    queryVisible(query: VisibilityCameraQuery): VisibilityQueryResult {
      const visible = normalized.filter((chunk) => isChunkVisible(chunk, query));
      const modelIdMap: ModelIdMap = {};
      for (const chunk of visible) {
        const set = modelIdMap[chunk.modelId] ?? new Set<number>();
        for (const id of chunk.localIds) set.add(id);
        modelIdMap[chunk.modelId] = set;
      }
      return {
        chunkIds: visible.map((chunk) => chunk.chunkId),
        modelIdMap,
        visibleElementCount: Object.values(modelIdMap).reduce((sum, ids) => sum + ids.size, 0),
      };
    },
    get chunks() {
      return normalized.map((chunk) => ({ ...chunk, localIds: [...chunk.localIds] }));
    },
  };
}

export function isChunkVisible(chunk: VisibilityChunk, query: VisibilityCameraQuery) {
  const center = getBoxCenter(chunk.box);
  const distanceToCamera = distance(center, query.position);
  const distanceToTarget = distance(center, query.target);
  return Math.min(distanceToCamera, distanceToTarget) <= Math.max(0, query.maxDistance);
}

export function getBoxCenter(box: VisibilityBox): Vec3 {
  return [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
}

function distance(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
