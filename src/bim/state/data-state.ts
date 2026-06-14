import type { BimElementRecord } from "../data/element-index";
import type { ElementRelationGraph } from "../data/relation-types";

export type DataWorkspaceState = {
  elementIndex: BimElementRecord[];
  filteredElements: BimElementRecord[];
  elementRelations: ElementRelationGraph;
};

export function createDataState(): DataWorkspaceState {
  return {
    elementIndex: [],
    filteredElements: [],
    elementRelations: { edges: [], outgoing: {}, incoming: {} },
  };
}

export function getIndexedElementCount(dataState: DataWorkspaceState) {
  return dataState.elementIndex.length;
}

export function getFilteredElementCount(dataState: DataWorkspaceState) {
  return dataState.filteredElements.length;
}
