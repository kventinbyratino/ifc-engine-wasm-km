import type { FragmentRecord, ModelIdMap, Profile } from "../types";
import type { BimElementRecord } from "../data/element-index";
import type { ModelHealthReport } from "../checks/check-types";
import type { ClashRecord } from "../clash/clash-types";
import type { DrawingRecord } from "../drawings/drawings-panel";
import type { SheetRecord } from "../sheets/sheet-types";
import {
  createViewerState,
  getSelectionCount,
  isSelectionEmpty,
  type ViewerWorkspaceState,
} from "./viewer-state";
import {
  createDataState,
  getFilteredElementCount,
  getIndexedElementCount,
  type DataWorkspaceState,
} from "./data-state";
import { createChecksState, getHealthIssueCount, type ChecksWorkspaceState } from "./checks-state";
import { createIssuesState, hasActiveIssue, type IssuesWorkspaceState } from "./issues-state";
import { createClashState, getClashCount, type ClashWorkspaceState } from "./clash-state";
import {
  createDrawingsState,
  getActiveDrawing,
  getActiveSheet,
  getDrawingStats,
  type DrawingsWorkspaceState,
} from "./drawings-state";

export type WorkspaceState = {
  viewer: ViewerWorkspaceState;
  data: DataWorkspaceState;
  checks: ChecksWorkspaceState;
  issues: IssuesWorkspaceState;
  clash: ClashWorkspaceState;
  drawings: DrawingsWorkspaceState;
};

export function createWorkspaceState(): WorkspaceState {
  return {
    viewer: createViewerState(),
    data: createDataState(),
    checks: createChecksState(),
    issues: createIssuesState(),
    clash: createClashState(),
    drawings: createDrawingsState(),
  };
}

export type { Profile, ModelIdMap, FragmentRecord, BimElementRecord, ModelHealthReport, ClashRecord, DrawingRecord, SheetRecord };

export { getSelectionCount, isSelectionEmpty, getIndexedElementCount, getFilteredElementCount, getHealthIssueCount, hasActiveIssue, getClashCount, getActiveDrawing, getActiveSheet, getDrawingStats };
