import test from "node:test";
import assert from "node:assert/strict";

import { buildFederationPanelSnapshot } from "../../src/bim/ui/federation-panel.ts";

test("buildFederationPanelSnapshot summarizes visible federation models", () => {
  const snapshot = buildFederationPanelSnapshot([
    {
      sourceKey: "ifc:alpha",
      modelId: "model-alpha",
      name: "Alpha",
      discipline: "AR",
      color: "#16a34a",
      elementCount: 12,
      status: "ready",
      visible: true,
      opacity: 1,
      error: "",
      source: { kind: "ifc", origin: "example", label: "Alpha.ifc", reference: "alpha.ifc", restorable: true },
    },
    {
      sourceKey: "frag:beta",
      modelId: "model-beta",
      name: "Beta",
      discipline: "MEP",
      color: "#f97316",
      elementCount: 8,
      status: "restoring",
      visible: false,
      opacity: 0.45,
      error: "",
      source: { kind: "frag", origin: "library", label: "Beta.frag", reference: "beta.frag", restorable: true },
    },
  ]);

  assert.equal(snapshot.headline, "2 models · 1 visible · 20 elements");
  assert.equal(snapshot.totalModels, 2);
  assert.equal(snapshot.visibleModels, 1);
  assert.equal(snapshot.totalElements, 20);
  assert.equal(snapshot.cards.length, 2);
  assert.equal(snapshot.cards[0].title, "AR · Alpha");
  assert.equal(snapshot.cards[0].badge, "12");
  assert.equal(snapshot.cards[1].status, "restoring");
  assert.equal(snapshot.cards[1].visible, false);
  assert.equal(snapshot.cards[1].opacity, 0.45);
});

test("buildFederationPanelSnapshot returns an empty state when no models are loaded", () => {
  const snapshot = buildFederationPanelSnapshot([]);

  assert.equal(snapshot.headline, "Федерация пуста");
  assert.equal(snapshot.emptyMessage, "Загрузите хотя бы одну модель, чтобы увидеть controls федерации.");
  assert.equal(snapshot.cards.length, 0);
});
