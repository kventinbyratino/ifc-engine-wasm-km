export type {
  ElementRecord,
  BimElementRecord,
} from "./model-index.ts";
export type { ElementIndexFilters } from "./element-index-types.ts";
export type { ElementRelationEdge, ElementRelationEndpoint, ElementRelationGraph, ElementRelationType } from "./relation-types.ts";
export {
  buildElementRelationGraph,
  createEmptyElementRelationGraph,
  getElementRelationCount,
  getIncomingElementRelations,
  getOutgoingElementRelations,
} from "./element-relations.ts";
export {
  buildModelIndex as buildElementIndex,
  filterModelIndex as filterElementIndex,
  recordsToModelIdMap,
  getUniqueValues,
} from "./model-index.ts";
