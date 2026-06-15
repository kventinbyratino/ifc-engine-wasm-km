import type { BimElementRecord } from "../data/element-index.ts";
import { BBoxIndex, getCachedElementBoxes } from "../spatial/bbox-index.ts";
import type { FragmentsBBoxProvider, ElementBox } from "./clash-types.ts";

export async function getClashCandidateBoxes(
  fragments: FragmentsBBoxProvider,
  records: BimElementRecord[],
  bboxIndex: BBoxIndex,
  signal?: AbortSignal,
): Promise<ElementBox[]> {
  return getCachedElementBoxes({ index: bboxIndex, fragments, records, signal });
}

export function shouldKeepClashPair(a: BimElementRecord, b: BimElementRecord, crossModelOnly = false) {
  return !crossModelOnly || a.modelId !== b.modelId;
}
