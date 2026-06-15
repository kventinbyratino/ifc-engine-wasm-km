import test from "node:test";
import assert from "node:assert/strict";

import { createWorkspaceState } from "../../src/bim/state/workspace-state.ts";
import { saveFederationSnapshot, normalizeStoredFederationSnapshot, restoreFederationSnapshot } from "../../src/bim/federation/federation-snapshot.ts";

function createModelRecord() {
  return {
    sourceKey: "frag:alpha",
    modelId: "alpha-1",
    name: "Alpha",
    discipline: "AR",
    color: "#16a34a",
    elementCount: 12,
    status: "ready",
    visible: false,
    opacity: 0.65,
    error: "",
    source: {
      kind: "frag",
      origin: "library",
      label: "Alpha",
      reference: "alpha",
      restorable: true,
    },
  };
}

test("federation snapshot preserves registry state and viewer selection", () => {
  const workspace = createWorkspaceState();
  workspace.federation.models = [createModelRecord()];
  workspace.federation.filters.activePresetId = "custom";
  workspace.federation.filters.selectedModelIds = ["alpha-1"];
  workspace.federation.lastAction = "toggle-visibility";
  workspace.federation.lastActionAt = "2026-01-01T00:00:00.000Z";
  workspace.federation.actionHistory = ["sync", "toggle-visibility"];
  workspace.viewer.activeSelection = { "alpha-1": new Set([1, 2]) };
  workspace.viewer.lastFederationSyncAt = "2026-01-01T00:00:01.000Z";

  const payload = saveFederationSnapshot(workspace);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(workspace.viewer.lastFederationSnapshotAt, payload.savedAt);
  assert.equal(payload.federation.models[0].visible, false);
  assert.equal(payload.federation.filters.selectedModelIds[0], "alpha-1");
  assert.equal(payload.federation.lastAction, "toggle-visibility");
  assert.equal(payload.viewer.lastFederationSyncAt, "2026-01-01T00:00:01.000Z");
  assert.deepEqual(payload.viewer.activeSelection, [["alpha-1", [1, 2]]]);

  const normalized = normalizeStoredFederationSnapshot(payload);
  assert.ok(normalized);
  assert.equal(normalized.federation.lastAction, "toggle-visibility");
  assert.equal(normalized.viewer.activeSelection[0][0], "alpha-1");

  const restored = createWorkspaceState();
  restoreFederationSnapshot(restored, normalized);
  assert.equal(restored.federation.models[0].name, "Alpha");
  assert.equal(restored.federation.filters.selectedModelIds[0], "alpha-1");
  assert.equal(restored.federation.lastAction, "toggle-visibility");
  assert.deepEqual([...restored.viewer.activeSelection["alpha-1"]], [1, 2]);
  assert.equal(restored.viewer.lastFederationSyncAt, "2026-01-01T00:00:01.000Z");
  assert.equal(restored.viewer.lastFederationSnapshotAt, payload.savedAt);
});
