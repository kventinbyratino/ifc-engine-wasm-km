import type { FragmentRecord, ModelIdMap } from "../types";
import type { BimElementRecord } from "../data/element-index";

export type WorkspaceState = {
  activeSelection: ModelIdMap;
  lastConvertedModelId: string;
  lastSourceIfcName: string;
  activeShareRecord: FragmentRecord | null;
  elementIndex: BimElementRecord[];
  filteredElements: BimElementRecord[];
};

export function createWorkspaceState(): WorkspaceState {
  return {
    activeSelection: {},
    lastConvertedModelId: "",
    lastSourceIfcName: "",
    activeShareRecord: null,
    elementIndex: [],
    filteredElements: [],
  };
}
