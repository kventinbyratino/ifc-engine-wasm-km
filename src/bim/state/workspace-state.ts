import type { FragmentRecord, ModelIdMap } from "../types";

export type WorkspaceState = {
  activeSelection: ModelIdMap;
  lastConvertedModelId: string;
  lastSourceIfcName: string;
  activeShareRecord: FragmentRecord | null;
};

export function createWorkspaceState(): WorkspaceState {
  return {
    activeSelection: {},
    lastConvertedModelId: "",
    lastSourceIfcName: "",
    activeShareRecord: null,
  };
}
