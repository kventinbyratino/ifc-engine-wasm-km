import type { FragmentRecord, ModelIdMap } from "../types";
import type { BimElementRecord } from "../data/element-index";
import type { DrawingRecord } from "../drawings/drawings-panel";

export type WorkspaceState = {
  activeSelection: ModelIdMap;
  lastConvertedModelId: string;
  lastSourceIfcName: string;
  activeShareRecord: FragmentRecord | null;
  elementIndex: BimElementRecord[];
  filteredElements: BimElementRecord[];
  drawings: DrawingRecord[];
};

export function createWorkspaceState(): WorkspaceState {
  return {
    activeSelection: {},
    lastConvertedModelId: "",
    lastSourceIfcName: "",
    activeShareRecord: null,
    elementIndex: [],
    filteredElements: [],
    drawings: [],
  };
}
