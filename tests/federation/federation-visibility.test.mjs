import test from "node:test";
import assert from "node:assert/strict";

import {
  isolateFederationModel,
  restoreFederationVisibility,
  toggleFederationModelVisibility,
  updateFederationModelOpacity,
} from "../../src/bim/federation/federation-actions.ts";
import { createFederationRegistryState } from "../../src/bim/federation/federation-registry.ts";

function createModel(modelId, visible = true, opacity = 1) {
  return {
    sourceKey: `${modelId}:source`,
    modelId,
    name: modelId,
    discipline: "AR",
    color: "#16a34a",
    elementCount: 1,
    status: "ready",
    visible,
    opacity,
    error: "",
    source: { kind: "ifc", origin: "example", label: modelId, reference: modelId, restorable: true },
  };
}

test("toggleFederationModelVisibility and updateFederationModelOpacity mutate the matching record", () => {
  const state = createFederationRegistryState();
  state.models = [createModel("model-a"), createModel("model-b", false, 0.5)];

  toggleFederationModelVisibility(state, "model-b");
  updateFederationModelOpacity(state, "model-a", 0.35);

  assert.equal(state.models[0].visible, true);
  assert.equal(state.models[0].opacity, 0.35);
  assert.equal(state.models[1].visible, true);
  assert.equal(state.models[1].opacity, 0.5);
});

test("restoreFederationVisibility and isolateFederationModel rebuild a single-model focus", () => {
  const state = createFederationRegistryState();
  state.models = [createModel("model-a", false), createModel("model-b", false), createModel("model-c", true)];

  restoreFederationVisibility(state);
  assert.deepEqual(state.models.map((model) => model.visible), [true, true, true]);

  isolateFederationModel(state, "model-b");
  assert.deepEqual(state.models.map((model) => model.visible), [false, true, false]);
});
