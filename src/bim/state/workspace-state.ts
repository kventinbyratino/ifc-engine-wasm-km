import type { FragmentRecord, ModelIdMap, Profile } from "../types";
import type { BimElementRecord } from "../data/element-index";
import type { DrawingRecord } from "../drawings/drawings-panel";

export type WorkspaceState = {
  activeProfile: Profile;
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
    activeProfile: "pending",
    activeSelection: {},
    lastConvertedModelId: "",
    lastSourceIfcName: "",
    activeShareRecord: null,
    elementIndex: [],
    filteredElements: [],
    drawings: [],
  };
}
