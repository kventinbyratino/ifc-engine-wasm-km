import type { ModelIdMap } from "../types.ts";

export type DrawingSelectionSource = {
  id: string;
  name: string;
  sourceModelIdMap: ModelIdMap;
};

export function cloneModelIdMap(modelIdMap: ModelIdMap): ModelIdMap {
  const result: ModelIdMap = {};
  for (const [modelId, localIds] of Object.entries(modelIdMap)) {
    result[modelId] = new Set(localIds);
  }
  return result;
}

export function serializeModelIdMap(modelIdMap: ModelIdMap) {
  return Object.entries(modelIdMap).map(([modelId, localIds]) => [modelId, [...localIds].sort((a, b) => a - b)] as [string, number[]]);
}

export function deserializeModelIdMap(entries: unknown): ModelIdMap {
  if (!Array.isArray(entries)) return {};

  const result: ModelIdMap = {};
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [modelId, ids] = entry as [unknown, unknown];
    if (typeof modelId !== "string" || !Array.isArray(ids)) continue;

    const validIds = ids.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (validIds.length > 0) result[modelId] = new Set(validIds);
  }
  return result;
}

export function countModelIdMapOverlap(source: ModelIdMap, selection: ModelIdMap) {
  let total = 0;
  for (const [modelId, localIds] of Object.entries(source)) {
    const selectedIds = selection[modelId];
    if (!selectedIds) continue;
    for (const localId of localIds) {
      if (selectedIds.has(localId)) total += 1;
    }
  }
  return total;
}

export function findBestMatchingDrawing<T extends DrawingSelectionSource>(drawings: T[], selection: ModelIdMap) {
  let best: { drawing: T; overlap: number; sourceCount: number } | null = null;

  for (const drawing of drawings) {
    const overlap = countModelIdMapOverlap(drawing.sourceModelIdMap, selection);
    if (overlap <= 0) continue;

    const sourceCount = countModelIdMapOverlap(drawing.sourceModelIdMap, drawing.sourceModelIdMap);
    if (!best || overlap > best.overlap || (overlap === best.overlap && sourceCount < best.sourceCount)) {
      best = { drawing, overlap, sourceCount };
    }
  }

  return best;
}
