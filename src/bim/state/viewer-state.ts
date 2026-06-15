import type { FragmentRecord, ModelIdMap, Profile } from "../types";
import { countSelection } from "../selection/selection";

export type ViewerWorkspaceState = {
  activeProfile: Profile;
  activeSelection: ModelIdMap;
  lastConvertedModelId: string;
  lastSourceIfcName: string;
  activeShareRecord: FragmentRecord | null;
  lastFederationSyncAt: string;
};

export function createViewerState(): ViewerWorkspaceState {
  return {
    activeProfile: "pending",
    activeSelection: {},
    lastConvertedModelId: "",
    lastSourceIfcName: "",
    activeShareRecord: null,
    lastFederationSyncAt: "",
  };
}

export function isSelectionEmpty(viewerState: ViewerWorkspaceState) {
  return countSelection(viewerState.activeSelection) === 0;
}

export function getSelectionCount(viewerState: ViewerWorkspaceState) {
  return countSelection(viewerState.activeSelection);
}
