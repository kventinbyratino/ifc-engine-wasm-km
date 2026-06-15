import type { BimElementRecord } from "../data/element-index.ts";
import type { ElementRelationGraph } from "../data/relation-types.ts";

import type { ProgressiveLoadPlan } from "../performance/lod-loader.ts";
import { createEmptyIfcOverrideState, type IfcOverrideState } from "../ifc-overrides/override-types.ts";

export type DataWorkspaceState = {
  elementIndex: BimElementRecord[];
  filteredElements: BimElementRecord[];
  elementRelations: ElementRelationGraph;
  progressiveLoadPlan: ProgressiveLoadPlan | null;
  pendingIfcOverrideCount: number;
};

export function createDataState(): DataWorkspaceState {
  return {
    elementIndex: [],
    filteredElements: [],
    elementRelations: { edges: [], outgoing: {}, incoming: {} },
    progressiveLoadPlan: null,
    pendingIfcOverrideCount: createEmptyIfcOverrideState().pendingCount,
  };
}

export function getIndexedElementCount(dataState: DataWorkspaceState) {
  return dataState.elementIndex.length;
}

export function getFilteredElementCount(dataState: DataWorkspaceState) {
  return dataState.filteredElements.length;
}
