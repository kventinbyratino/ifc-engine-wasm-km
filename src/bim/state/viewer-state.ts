import type { FragmentRecord, ModelIdMap, Profile } from "../types.ts";
import { countSelection } from "../selection/selection.ts";

export type ViewerWorkspaceState = {
  activeProfile: Profile;
  activeSelection: ModelIdMap;
  lastConvertedModelId: string;
  lastSourceIfcName: string;
  activeShareRecord: FragmentRecord | null;
  lastFederationSyncAt: string;
  lastFederationSnapshotAt: string;
};

export function createViewerState(): ViewerWorkspaceState {
  return {
    activeProfile: "pending",
    activeSelection: {},
    lastConvertedModelId: "",
    lastSourceIfcName: "",
    activeShareRecord: null,
    lastFederationSyncAt: "",
    lastFederationSnapshotAt: "",
  };
}

export function isSelectionEmpty(viewerState: ViewerWorkspaceState) {
  return countSelection(viewerState.activeSelection) === 0;
}

export function getSelectionCount(viewerState: ViewerWorkspaceState) {
  return countSelection(viewerState.activeSelection);
}
