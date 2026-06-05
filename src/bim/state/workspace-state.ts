import type { FragmentRecord, ModelIdMap, Profile } from "../types";
import type { BimElementRecord } from "../data/element-index";
import type { DrawingRecord } from "../drawings/drawings-panel";
import type { ModelHealthReport } from "../checks/check-types";
import type { ClashRecord } from "../clash/clash-types";

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
  clashes: ClashRecord[];
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
    clashes: [],
  };
}
