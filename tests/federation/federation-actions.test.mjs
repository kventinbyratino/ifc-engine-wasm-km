import test from "node:test";
import assert from "node:assert/strict";

import {
  getFederationModelById,
  removeFederationModel,
  isolateFederationModel,
} from "../../src/bim/federation/federation-actions.ts";
import { createFederationRegistryState } from "../../src/bim/federation/federation-registry.ts";

function createModel(modelId) {
  return {
    sourceKey: `${modelId}:source`,
    modelId,
    name: modelId,
    discipline: "MEP",
    color: "#f97316",
    elementCount: 4,
    status: "ready",
    visible: true,
    opacity: 1,
    error: "",
    source: { kind: "frag", origin: "library", label: modelId, reference: modelId, restorable: true },
  };
}

test("getFederationModelById returns the expected record", () => {
  const state = createFederationRegistryState();
  state.models = [createModel("model-a"), createModel("model-b")];

  const model = getFederationModelById(state, "model-b");

  assert.equal(model?.modelId, "model-b");
  assert.equal(getFederationModelById(state, "missing"), null);
});

test("isolateFederationModel followed by removeFederationModel keeps state consistent", () => {
  const state = createFederationRegistryState();
  state.models = [createModel("model-a"), createModel("model-b"), createModel("model-c")];

  isolateFederationModel(state, "model-c");
  assert.deepEqual(state.models.map((model) => model.visible), [false, false, true]);

  removeFederationModel(state, "model-b");
  assert.deepEqual(state.models.map((model) => model.modelId), ["model-a", "model-c"]);
  assert.deepEqual(state.models.map((model) => model.visible), [false, true]);
});
