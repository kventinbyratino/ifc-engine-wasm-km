import type { FragmentRecord, ModelIdMap, Profile } from "../types";
import type { BimElementRecord } from "../data/element-index";
import type { DrawingRecord } from "../drawings/drawings-panel";
import type { ModelHealthReport } from "../checks/check-types";

export type WorkspaceState = {
  activeProfile: Profile;
  activeSelection: ModelIdMap;
  lastConvertedModelId: string;
  lastSourceIfcName: string;
  activeShareRecord: FragmentRecord | null;
  elementIndex: BimElementRecord[];
  filteredElements: BimElementRecord[];
  drawings: DrawingRecord[];
  healthReport: ModelHealthReport | null;
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
    healthReport: null,
  };
}
