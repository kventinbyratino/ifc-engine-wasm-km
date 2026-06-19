import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOverrideEditorViewModel,
  formatOverrideValue,
} from "../../src/bim/properties/properties-override-ux.ts";

test("buildOverrideEditorViewModel shows selected override and pending list actions", () => {
  const viewModel = buildOverrideEditorViewModel({
    selection: { modelId: "model-a", localId: 42 },
    state: {
      pendingCount: 2,
      propertyCount: 2,
      classCount: 0,
      lastUpdatedAt: "2026-06-19T10:00:00.000Z",
      pendingOverrides: [
        {
          kind: "property",
          key: "property:model-a:42:Pset_WallCommon:FireRating",
          modelId: "model-a",
          localId: 42,
          propertySet: "Pset_WallCommon",
          propertyName: "FireRating",
          value: "EI60",
          status: "pending",
          createdAt: "2026-06-19T09:00:00.000Z",
          updatedAt: "2026-06-19T10:00:00.000Z",
        },
        {
          kind: "property",
          key: "property:model-b:7:Pset_DoorCommon:IsExternal",
          modelId: "model-b",
          localId: 7,
          propertySet: "Pset_DoorCommon",
          propertyName: "IsExternal",
          value: false,
          status: "pending",
          createdAt: "2026-06-19T09:30:00.000Z",
          updatedAt: "2026-06-19T09:30:00.000Z",
        },
      ],
    },
  });

  assert.equal(viewModel.summary, "2 pending · 2 property · 0 class");
  assert.equal(viewModel.selectionLabel, "model-a #42");
  assert.equal(viewModel.selectedPropertyKey, "Pset_WallCommon.FireRating");
  assert.equal(viewModel.selectedStatus, "изменено");
  assert.equal(viewModel.canClear, true);
  assert.equal(viewModel.pendingItems.length, 2);
  assert.deepEqual(viewModel.pendingItems[0], {
    key: "property:model-a:42:Pset_WallCommon:FireRating",
    title: "Pset_WallCommon.FireRating",
    target: "model-a #42",
    valueLabel: "EI60",
    statusLabel: "изменено",
  });
});

test("formatOverrideValue is readable for object, boolean and empty values", () => {
  assert.equal(formatOverrideValue(true), "true");
  assert.equal(formatOverrideValue(null), "null");
  assert.equal(formatOverrideValue(""), "пустое значение");
  assert.equal(formatOverrideValue({ fire: "EI60", acoustic: 42 }), '{"fire":"EI60","acoustic":42}');
});
