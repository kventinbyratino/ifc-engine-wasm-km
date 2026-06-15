import test from "node:test";
import assert from "node:assert/strict";

import {
  createFederationRegistryState,
  markFederationRestored,
} from "../../src/bim/federation/federation-registry.ts";
import {
  normalizeStoredFederationWorkspace,
  restoreFederationState,
  saveFederationWorkspace,
  serializeFederationWorkspace,
} from "../../src/bim/federation/federation-persistence.ts";

test("serialize and restore federation workspace round-trip", () => {
  const state = createFederationRegistryState();
  state.models = [
    {
      sourceKey: "frag:alpha",
      modelId: "alpha-1",
      name: "Alpha",
      discipline: "AR",
      color: "#16a34a",
      elementCount: 12,
      status: "ready",
      visible: true,
      opacity: 0.8,
      error: "",
      source: {
        kind: "frag",
        origin: "library",
        label: "Alpha",
        reference: "alpha",
        restorable: true,
      },
    },
  ];
  markFederationRestored(state, true);

  const payload = serializeFederationWorkspace(state);
  const normalized = normalizeStoredFederationWorkspace(payload);

  assert.ok(normalized);
  assert.equal(normalized.savedAt, payload.savedAt);
  assert.equal(normalized.models.length, 1);
  assert.equal(normalized.models[0].source.reference, "alpha");
  assert.equal(normalized.models[0].source.origin, "library");

  const restored = createFederationRegistryState();
  restoreFederationState(restored, normalized);
  assert.equal(restored.models.length, 1);
  assert.equal(restored.models[0].name, "Alpha");
  assert.equal(restored.restoredFromStorage, true);
  assert.equal(restored.lastSavedAt, payload.savedAt);
});

test("saveFederationWorkspace writes without localStorage and returns payload", () => {
  const state = createFederationRegistryState();
  const payload = saveFederationWorkspace(state);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.models.length, 0);
});
