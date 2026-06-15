import type { Box3 } from "three";
import type { BimElementRecord } from "../data/element-index.ts";
import type { BBoxIndex } from "../spatial/bbox-index.ts";
import type { ModelIdMap } from "../types.ts";

export type FragmentsBBoxProvider = {
  getBBoxes(modelIdMap: ModelIdMap): Promise<Box3[]>;
};

export type ClashSeverity = "critical" | "warning" | "info";

export type ClashRecord = {
  id: string;
  title: string;
  description: string;
  severity: ClashSeverity;
  a: BimElementRecord;
  b: BimElementRecord;
  overlapVolume: number;
  modelIdMap: ModelIdMap;
};

export type ClashDetectionInput = {
  groupA: BimElementRecord[];
  groupB: BimElementRecord[];
  tolerance: number;
  limit: number;
  bboxIndex?: BBoxIndex;
  signal?: AbortSignal;
  crossModelOnly?: boolean;
};

export type ClashDetectionResult = {
  clashes: ClashRecord[];
  checkedPairs: number;
  skippedPairs: number;
};

export type ElementBox = {
  record: BimElementRecord;
  box: Box3;
};
