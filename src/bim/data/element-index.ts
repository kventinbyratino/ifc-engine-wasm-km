export type {
  ElementRecord,
  BimElementRecord,
} from "./model-index";
export type { ElementIndexFilters } from "./element-index-types";
export {
  buildModelIndex as buildElementIndex,
  filterModelIndex as filterElementIndex,
  recordsToModelIdMap,
  getUniqueValues,
} from "./model-index";
