export type {
  ElementRecord,
  BimElementRecord,
  ModelIndexFilters as ElementIndexFilters,
} from "./model-index";
export {
  buildModelIndex as buildElementIndex,
  filterModelIndex as filterElementIndex,
  recordsToModelIdMap,
  getUniqueValues,
} from "./model-index";
