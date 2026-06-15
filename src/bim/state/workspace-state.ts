import type { FragmentRecord, ModelIdMap, Profile } from "../types.ts";
import type { BimElementRecord } from "../data/element-index.ts";
import type { ModelHealthReport } from "../checks/check-types.ts";
import type { ClashRecord } from "../clash/clash-types.ts";
import type { DrawingRecord } from "../drawings/drawings-panel.ts";
import type { SheetRecord } from "../sheets/sheet-types.ts";
import { createFederationRegistryState, type FederationRegistryState } from "../federation/federation-registry.ts";
import { MODEL_CACHE_SCHEMA_VERSION } from "../storage/indexeddb-schema.ts";
import { createEmptyIfcOverrideState, type IfcOverrideState } from "../ifc-overrides/override-types.ts";
import {
  createViewerState,
  getSelectionCount,
  isSelectionEmpty,
  type ViewerWorkspaceState,
} from "./viewer-state.ts";
import {
  createDataState,
  getFilteredElementCount,
  getIndexedElementCount,
  type DataWorkspaceState,
} from "./data-state.ts";
import { createChecksState, getHealthIssueCount, type ChecksWorkspaceState } from "./checks-state.ts";
import { createIssuesState, hasActiveIssue, type IssuesWorkspaceState } from "./issues-state.ts";
import { createClashState, getClashCount, type ClashWorkspaceState } from "./clash-state.ts";
import {
  createDrawingsState,
  getActiveDrawing,
  setActiveDrawing,
  getActiveSheet,
  getDrawingStats,
  type DrawingsWorkspaceState,
} from "./drawings-state.ts";

export type WorkspaceState = {
  viewer: ViewerWorkspaceState;
  data: DataWorkspaceState;
  ifcOverrides: IfcOverrideState;
  checks: ChecksWorkspaceState;
  issues: IssuesWorkspaceState;
  clash: ClashWorkspaceState;
  drawings: DrawingsWorkspaceState;
  federation: FederationRegistryState;
  storage: {
    modelCacheSchemaVersion: number;
    lastModelCacheCleanupAt: string;
  };
};

export type FederationSnapshotWorkspaceState = Pick<ViewerWorkspaceState, "lastFederationSyncAt" | "lastFederationSnapshotAt">;

export function createWorkspaceState(): WorkspaceState {
  return {
    viewer: createViewerState(),
    data: createDataState(),
    ifcOverrides: createEmptyIfcOverrideState(),
    checks: createChecksState(),
    issues: createIssuesState(),
    clash: createClashState(),
    drawings: createDrawingsState(),
    federation: createFederationRegistryState(),
    storage: {
      modelCacheSchemaVersion: MODEL_CACHE_SCHEMA_VERSION,
      lastModelCacheCleanupAt: "",
    },
  };
}

export type { Profile, ModelIdMap, FragmentRecord, BimElementRecord, ModelHealthReport, ClashRecord, DrawingRecord, SheetRecord };

export { getSelectionCount, isSelectionEmpty, getIndexedElementCount, getFilteredElementCount, getHealthIssueCount, hasActiveIssue, getClashCount, getActiveDrawing, setActiveDrawing, getActiveSheet, getDrawingStats };
