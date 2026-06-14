import test from "node:test";
import assert from "node:assert/strict";

import { buildFederationViewSnapshot } from "../src/bim/federation/federation-view.ts";

test("buildFederationViewSnapshot summarizes federated models for the UI", () => {
  const snapshot = buildFederationViewSnapshot([
    { modelId: "model-ar", name: "AR Model", discipline: "AR", color: "#16a34a", elementCount: 42 },
    { modelId: "model-mep", name: "MEP Model", discipline: "MEP", color: "#f97316", elementCount: 17 },
  ]);

  assert.equal(snapshot.headline, "2 models · 59 elements");
  assert.equal(snapshot.totalModels, 2);
  assert.equal(snapshot.totalElements, 59);
  assert.deepEqual(snapshot.disciplines, ["AR", "MEP"]);
  assert.equal(snapshot.cards[0].label, "AR · AR Model");
  assert.equal(snapshot.cards[0].badge, "42");
  assert.equal(snapshot.cards[1].label, "MEP · MEP Model");
  assert.equal(snapshot.cards[1].badge, "17");
});

test("buildFederationViewSnapshot returns a usable empty state", () => {
  const snapshot = buildFederationViewSnapshot([]);

  assert.equal(snapshot.headline, "Загрузите модели");
  assert.equal(snapshot.totalModels, 0);
  assert.equal(snapshot.totalElements, 0);
  assert.equal(snapshot.cards.length, 0);
  assert.equal(snapshot.emptyMessage, "Загрузите хотя бы одну модель, чтобы увидеть federation summary.");
});
