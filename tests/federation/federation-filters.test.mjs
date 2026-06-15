import test from "node:test";
import assert from "node:assert/strict";

import {
  applyFederationFilters,
  applyFederationPreset,
  buildFederationFilterOptions,
  captureFederationPreset,
  createFederationFilterState,
  filterFederationModels,
  normalizeFederationFilterState,
  removeFederationPreset,
  saveFederationPreset,
  setFederationFilterSelections,
} from "../../src/bim/federation/federation-filters.ts";
import { summarizeFederatedModels } from "../../src/bim/federation/federation.ts";

function createModels() {
  return summarizeFederatedModels([
    { modelId: "model-a", category: "IFCDOOR", storey: "L01" },
    { modelId: "model-a", category: "IFCWINDOW", storey: "L01" },
    { modelId: "model-b", category: "IFCDUCTSEGMENT", storey: "L02" },
    { modelId: "model-c", category: "IFCBEAM", storey: "L03" },
  ]);
}

function createRecords() {
  return [
    { modelId: "model-a", category: "IFCDOOR", storey: "L01" },
    { modelId: "model-a", category: "IFCWINDOW", storey: "L01" },
    { modelId: "model-b", category: "IFCDUCTSEGMENT", storey: "L02" },
    { modelId: "model-c", category: "IFCBEAM", storey: "L03" },
  ];
}

test("federation filters narrow models and records by selected dimensions", () => {
  const state = createFederationFilterState();
  const models = createModels();
  const records = createRecords();

  setFederationFilterSelections(state, {
    selectedModelIds: ["model-a", "model-b"],
    selectedDisciplines: ["AR", "MEP"],
    selectedStoreys: ["L01", "L02"],
    selectedCategories: ["IFCDOOR", "IFCDUCTSEGMENT"],
  });

  const filteredModels = filterFederationModels(models, state);
  const filteredRecords = applyFederationFilters(records, models, state);

  assert.deepEqual(filteredModels.map((model) => model.modelId), ["model-a", "model-b"]);
  assert.deepEqual(filteredRecords.map((record) => record.category), ["IFCDOOR", "IFCDUCTSEGMENT"]);
});

test("preset capture/apply/save/remove keeps reproducible filter sets", () => {
  const state = createFederationFilterState();
  setFederationFilterSelections(state, {
    selectedModelIds: ["model-b"],
    selectedDisciplines: ["MEP"],
    selectedStoreys: ["L02"],
    selectedCategories: ["IFCDUCTSEGMENT"],
  });

  const preset = captureFederationPreset(state, "MEP L02");
  saveFederationPreset(state, preset);
  state.activePresetId = "all";
  setFederationFilterSelections(state, {
    selectedModelIds: [],
    selectedDisciplines: [],
    selectedStoreys: [],
    selectedCategories: [],
  });

  assert.equal(applyFederationPreset(state, preset.id), true);
  assert.deepEqual(state.selectedModelIds, ["model-b"]);
  assert.deepEqual(state.selectedDisciplines, ["MEP"]);
  assert.equal(state.activePresetId, preset.id);
  assert.equal(removeFederationPreset(state, preset.id), true);
  assert.equal(state.presets.some((item) => item.id === preset.id), false);
});

test("normalizeFederationFilterState drops stale ids and keeps available presets", () => {
  const state = createFederationFilterState();
  state.selectedModelIds = ["model-x"];
  state.selectedDisciplines = ["MEP", "ARCH"];
  state.selectedStoreys = ["L99"];
  state.selectedCategories = ["IFCFAKE"];
  state.activePresetId = "unknown";
  state.presets.push({ id: "custom", label: "Custom", modelIds: ["model-x"], disciplines: ["ARCH"], storeys: ["L99"], categories: ["IFCFAKE"] });

  const models = createModels();
  const records = createRecords();
  normalizeFederationFilterState(state, models, records);

  assert.deepEqual(state.selectedModelIds, []);
  assert.deepEqual(state.selectedDisciplines, ["MEP"]);
  assert.deepEqual(state.selectedStoreys, []);
  assert.deepEqual(state.selectedCategories, []);
  assert.equal(state.activePresetId, "all");
  assert.equal(state.presets.some((preset) => preset.id === "custom"), true);
});

test("buildFederationFilterOptions exposes model, discipline, storey, category and presets", () => {
  const state = createFederationFilterState();
  const models = createModels();
  const options = buildFederationFilterOptions(models, createRecords(), state);

  assert.equal(options.models[0].value, "model-a");
  assert.deepEqual(options.disciplines, ["AR", "AR/KR", "MEP"]);
  assert.deepEqual(options.storeys, ["L01", "L02", "L03"]);
  assert.deepEqual(options.categories, ["IFCBEAM", "IFCDOOR", "IFCDUCTSEGMENT", "IFCWINDOW"]);
  assert.ok(options.presets.some((preset) => preset.id === "all"));
});
