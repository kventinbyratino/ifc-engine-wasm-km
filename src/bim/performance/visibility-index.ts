import type { ModelIdMap } from "../types.ts";
import type { BoundingBox, LodChunkDetail, LodStableElementId, Vec3 } from "./lod-manifest.ts";

export type VisibilityChunk = {
  chunkId: string;
  modelId: string;
  localIds: number[];
  box: BoundingBox;
  detail?: LodChunkDetail;
  stableElementIds?: LodStableElementId[];
  floorId?: string;
  zoneId?: string;
  categoryIds?: string[];
};

export type VisibilityCameraQuery = {
  position: Vec3;
  target: Vec3;
  maxDistance: number;
  frustum?: BoundingBox;
  floorIds?: string[];
  zoneIds?: string[];
  categoryIds?: string[];
  selectedElements?: LodStableElementId[];
  chunkIds?: string[];
};

export type VisibilityQueryResult = {
  chunkIds: string[];
  modelIdMap: ModelIdMap;
  visibleElementCount: number;
};

export function createVisibilityIndex(chunks: VisibilityChunk[]) {
  const normalized = chunks.map((chunk) => normalizeChunk(chunk));
  const byChunkId = new Map(normalized.map((chunk) => [chunk.chunkId, chunk] as const));
  const byFloorId = groupChunks(normalized, (chunk) => chunk.floorId);
  const byZoneId = groupChunks(normalized, (chunk) => chunk.zoneId);
  const byCategoryId = groupChunks(normalized, (chunk) => chunk.categoryIds ?? []);

  return {
    queryVisible(query: VisibilityCameraQuery): VisibilityQueryResult {
      const selectedKeys = new Set((query.selectedElements ?? []).map(getStableKey));
      const candidates = resolveCandidates({
        normalized,
        byChunkId,
        byFloorId,
        byZoneId,
        byCategoryId,
        query,
        selectedKeys,
      });
      const visible = candidates.filter((chunk) => isChunkVisible(chunk, query) || isSelectedChunk(chunk, selectedKeys));
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
      return normalized.map((chunk) => ({
        ...chunk,
        localIds: [...chunk.localIds],
        categoryIds: chunk.categoryIds ? [...chunk.categoryIds] : undefined,
        stableElementIds: chunk.stableElementIds ? chunk.stableElementIds.map((item) => ({ ...item })) : undefined,
      }));
    },
  };
}

export function isChunkVisible(chunk: VisibilityChunk, query: VisibilityCameraQuery) {
  if (query.frustum && !intersectsBox(chunk.box, query.frustum)) return false;
  const center = getBoxCenter(chunk.box);
  const distanceToCamera = distance(center, query.position);
  const distanceToTarget = distance(center, query.target);
  return Math.min(distanceToCamera, distanceToTarget) <= Math.max(0, query.maxDistance);
}

export function getBoxCenter(box: BoundingBox): Vec3 {
  return [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
}

function resolveCandidates(options: {
  normalized: NormalizedVisibilityChunk[];
  byChunkId: Map<string, NormalizedVisibilityChunk>;
  byFloorId: Map<string, NormalizedVisibilityChunk[]>;
  byZoneId: Map<string, NormalizedVisibilityChunk[]>;
  byCategoryId: Map<string, NormalizedVisibilityChunk[]>;
  query: VisibilityCameraQuery;
  selectedKeys: Set<string>;
}) {
  let candidateMap = new Map(options.normalized.map((chunk) => [chunk.chunkId, chunk] as const));

  candidateMap = intersectCandidateMap(candidateMap, resolveFilteredBucket(options.byFloorId, options.query.floorIds));
  candidateMap = intersectCandidateMap(candidateMap, resolveFilteredBucket(options.byZoneId, options.query.zoneIds));
  candidateMap = intersectCandidateMap(candidateMap, resolveFilteredBucket(options.byCategoryId, options.query.categoryIds));
  candidateMap = intersectCandidateMap(candidateMap, resolveFilteredChunkIds(options.byChunkId, options.query.chunkIds));

  const selected = options.normalized.filter((chunk) => isSelectedChunk(chunk, options.selectedKeys) && !candidateMap.has(chunk.chunkId));
  return dedupeChunks([...candidateMap.values(), ...selected]);
}

function resolveFilteredBucket(bucket: Map<string, NormalizedVisibilityChunk[]>, keys?: string[]) {
  if (!keys?.length) return null;
  const chunks = new Map<string, NormalizedVisibilityChunk>();
  for (const key of keys) {
    for (const chunk of bucket.get(key) ?? []) chunks.set(chunk.chunkId, chunk);
  }
  return chunks;
}

function resolveFilteredChunkIds(byChunkId: Map<string, NormalizedVisibilityChunk>, chunkIds?: string[]) {
  if (!chunkIds?.length) return null;
  const chunks = new Map<string, NormalizedVisibilityChunk>();
  for (const chunkId of chunkIds) {
    const chunk = byChunkId.get(chunkId);
    if (chunk) chunks.set(chunkId, chunk);
  }
  return chunks;
}

function intersectCandidateMap(
  current: Map<string, NormalizedVisibilityChunk>,
  next: Map<string, NormalizedVisibilityChunk> | null,
) {
  if (!next) return current;
  const result = new Map<string, NormalizedVisibilityChunk>();
  for (const [chunkId, chunk] of current) {
    if (next.has(chunkId)) result.set(chunkId, chunk);
  }
  return result;
}

function isSelectedChunk(chunk: NormalizedVisibilityChunk, selectedKeys: Set<string>) {
  if (selectedKeys.size === 0) return false;
  for (const stableId of chunk.stableElementIds) {
    if (selectedKeys.has(getStableKey(stableId))) return true;
  }
  return false;
}

function dedupeChunks(chunks: NormalizedVisibilityChunk[]) {
  const seen = new Set<string>();
  const result: NormalizedVisibilityChunk[] = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.chunkId)) continue;
    seen.add(chunk.chunkId);
    result.push(chunk);
  }
  return result;
}

function normalizeChunk(chunk: VisibilityChunk): NormalizedVisibilityChunk {
  const localIds = uniqueNumbers(chunk.localIds);
  const stableElementIds = uniqueStableIds(chunk.stableElementIds ?? localIds.map((localId) => ({ modelId: chunk.modelId, localId })));
  const categoryIds = chunk.categoryIds ? uniqueStrings(chunk.categoryIds) : undefined;
  return {
    ...chunk,
    localIds,
    stableElementIds,
    categoryIds,
  };
}

type NormalizedVisibilityChunk = VisibilityChunk & {
  localIds: number[];
  stableElementIds: LodStableElementId[];
  categoryIds?: string[];
};

function groupChunks(chunks: NormalizedVisibilityChunk[], selector: (chunk: NormalizedVisibilityChunk) => string | string[] | undefined) {
  const groups = new Map<string, NormalizedVisibilityChunk[]>();
  for (const chunk of chunks) {
    const keys = selector(chunk);
    const list = Array.isArray(keys) ? keys : keys ? [keys] : [];
    for (const key of list) {
      const bucket = groups.get(key) ?? [];
      bucket.push(chunk);
      groups.set(key, bucket);
    }
  }
  return groups;
}

function uniqueStableIds(items: LodStableElementId[]) {
  const seen = new Set<string>();
  const result: LodStableElementId[] = [];
  for (const item of items) {
    const normalized = { modelId: normalizeText(item.modelId, "model"), localId: Math.max(0, Math.floor(item.localId)) };
    const key = getStableKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function uniqueNumbers(items: number[]) {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const item of items) {
    const normalized = Math.max(0, Math.floor(item));
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function uniqueStrings(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = normalizeText(item, "");
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function intersectsBox(a: BoundingBox, b: BoundingBox) {
  return !(
    a.max[0] < b.min[0] ||
    a.min[0] > b.max[0] ||
    a.max[1] < b.min[1] ||
    a.min[1] > b.max[1] ||
    a.max[2] < b.min[2] ||
    a.min[2] > b.max[2]
  );
}

function distance(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function getStableKey(item: LodStableElementId) {
  return `${normalizeText(item.modelId, "model")}:${Math.max(0, Math.floor(item.localId))}`;
}

function normalizeText(value: string | undefined, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}
