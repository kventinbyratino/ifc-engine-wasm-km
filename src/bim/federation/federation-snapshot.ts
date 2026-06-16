import { deserializeModelIdMap, serializeModelIdMap } from "../drawings/drawing-selection-sync.ts";
import type { WorkspaceState } from "../state/workspace-state.ts";
import { loadStoredJson, saveStoredJson } from "../storage/local-storage-json.ts";
import {
  normalizeStoredFederationWorkspace,
  restoreFederationState,
  saveFederationWorkspace,
  serializeFederationWorkspace,
  type StoredFederationWorkspace,
} from "./federation-persistence.ts";

export const FEDERATION_SNAPSHOT_STORAGE_KEY = "ifc-wasm-viewer:federation-snapshot:v1";
export const FEDERATION_SNAPSHOT_SCHEMA_VERSION = 1;

export type StoredFederationSnapshot = {
  schemaVersion: number;
  savedAt: string;
  federation: StoredFederationWorkspace;
  viewer: {
    activeSelection: Array<[string, number[]]>;
    lastFederationSyncAt: string;
    lastFederationSnapshotAt: string;
  };
};

export function saveFederationSnapshot(workspace: WorkspaceState) {
  saveFederationWorkspace(workspace.federation);
  const payload = serializeFederationSnapshot(workspace);
  saveStoredJson(FEDERATION_SNAPSHOT_STORAGE_KEY, payload);
  workspace.viewer.lastFederationSnapshotAt = payload.savedAt;
  return payload;
}

export function loadStoredFederationSnapshot() {
  return loadStoredJson(FEDERATION_SNAPSHOT_STORAGE_KEY, normalizeStoredFederationSnapshot, "Federation snapshot");
}

export function serializeFederationSnapshot(workspace: WorkspaceState): StoredFederationSnapshot {
  return {
    schemaVersion: FEDERATION_SNAPSHOT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    federation: serializeFederationWorkspace(workspace.federation),
    viewer: {
      activeSelection: serializeModelIdMap(workspace.viewer.activeSelection),
      lastFederationSyncAt: workspace.viewer.lastFederationSyncAt,
      lastFederationSnapshotAt: workspace.viewer.lastFederationSnapshotAt,
    },
  };
}

export function normalizeStoredFederationSnapshot(raw: unknown): StoredFederationSnapshot | null {
  if (!isRecord(raw)) return null;
  const federation = normalizeStoredFederationWorkspace(raw.federation);
  if (!federation) return null;

  return {
    schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : FEDERATION_SNAPSHOT_SCHEMA_VERSION,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString(),
    federation,
    viewer: normalizeViewerSnapshot(raw.viewer),
  };
}

export function restoreFederationSnapshot(workspace: WorkspaceState, stored: StoredFederationSnapshot) {
  restoreFederationState(workspace.federation, stored.federation);
  workspace.viewer.activeSelection = deserializeModelIdMap(stored.viewer.activeSelection);
  workspace.viewer.lastFederationSyncAt = stored.viewer.lastFederationSyncAt;
  workspace.viewer.lastFederationSnapshotAt = stored.savedAt;
}

function normalizeViewerSnapshot(raw: unknown) {
  if (!isRecord(raw)) {
    return {
      activeSelection: [] as Array<[string, number[]]>,
      lastFederationSyncAt: "",
      lastFederationSnapshotAt: "",
    };
  }

  return {
    activeSelection: serializeModelIdMap(deserializeModelIdMap(raw.activeSelection)),
    lastFederationSyncAt: typeof raw.lastFederationSyncAt === "string" ? raw.lastFederationSyncAt : "",
    lastFederationSnapshotAt: typeof raw.lastFederationSnapshotAt === "string" ? raw.lastFederationSnapshotAt : "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
