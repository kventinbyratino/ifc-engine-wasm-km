import test from "node:test";
import assert from "node:assert/strict";

import {
  createFederationRegistryState,
  syncFederationRegistry,
} from "../../src/bim/federation/federation-registry.ts";

test("syncFederationRegistry keeps stable federation metadata across refreshes", () => {
  const state = createFederationRegistryState();
  state.models = [
    {
      sourceKey: "frag:alpha",
      modelId: "model-old-alpha",
      name: "Alpha",
      discipline: "AR",
      color: "#16a34a",
      elementCount: 4,
      status: "ready",
      visible: false,
      opacity: 0.4,
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

  const records = [
    { modelId: "model-new-alpha", category: "IFCDOOR" },
    { modelId: "model-new-alpha", category: "IFCDOOR" },
    { modelId: "model-new-beta", category: "IFCPIPESEGMENT" },
  ];

  const models = new Map([
    ["model-new-alpha", { userData: { federationSource: { kind: "frag", origin: "library", label: "Alpha revised", reference: "alpha", restorable: true } } }],
    ["model-new-beta", { userData: { federationSource: { kind: "ifc", origin: "example", label: "Beta", reference: "beta.ifc", restorable: true } } }],
  ]);

  syncFederationRegistry({ state, models, records });

  assert.equal(state.models.length, 2);
  assert.equal(state.models[0].sourceKey, "frag:alpha");
  assert.equal(state.models[0].name, "Alpha revised");
  assert.equal(state.models[0].visible, false);
  assert.equal(state.models[0].opacity, 0.4);
  assert.equal(state.models[0].elementCount, 2);
  assert.equal(state.models[0].discipline, "AR");
  assert.equal(state.models[1].sourceKey, "ifc:beta.ifc");
  assert.equal(state.models[1].name, "Beta");
  assert.equal(state.models[1].elementCount, 1);
  assert.equal(state.models[1].discipline, "MEP");
  assert.equal(state.models[1].status, "restoring");
});
