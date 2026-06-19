import type { ModelIdMap } from "../types.ts";

export function countSelection(modelIdMap: ModelIdMap) {
  return Object.values(modelIdMap).reduce((sum, ids) => sum + ids.size, 0);
}

export function isEmptySelection(modelIdMap: ModelIdMap) {
  return countSelection(modelIdMap) === 0;
}

export function limitSelection(modelIdMap: ModelIdMap, maxItems: number) {
  const result: ModelIdMap = {};
  let remaining = maxItems;

  for (const [modelId, localIds] of Object.entries(modelIdMap)) {
    if (remaining <= 0) break;
    const ids = [...localIds].slice(0, remaining);
    result[modelId] = new Set(ids);
    remaining -= ids.length;
  }

  return result;
}

export function mergeModelIdMaps(...maps: ModelIdMap[]) {
  const result: ModelIdMap = {};
  for (const modelIdMap of maps) {
    for (const [modelId, localIds] of Object.entries(modelIdMap)) {
      const target = result[modelId] ?? new Set<number>();
      for (const localId of localIds) target.add(localId);
      if (target.size > 0) result[modelId] = target;
    }
  }
  return result;
}

export function subtractModelIdMap(source: ModelIdMap, remove: ModelIdMap) {
  const result: ModelIdMap = {};
  for (const [modelId, localIds] of Object.entries(source)) {
    const removeIds = remove[modelId] ?? new Set<number>();
    const visible = [...localIds].filter((localId) => !removeIds.has(localId));
    if (visible.length > 0) result[modelId] = new Set(visible);
  }
  return result;
}
