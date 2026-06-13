import type { BimElementRecord } from "../data/element-index";
import { BBoxIndex, getCachedElementBoxes } from "../spatial/bbox-index";
import type { FragmentsBBoxProvider, ElementBox } from "./clash-types";

export async function getClashCandidateBoxes(
  fragments: FragmentsBBoxProvider,
  records: BimElementRecord[],
  bboxIndex: BBoxIndex,
  signal?: AbortSignal,
): Promise<ElementBox[]> {
  return getCachedElementBoxes({ index: bboxIndex, fragments, records, signal });
}
