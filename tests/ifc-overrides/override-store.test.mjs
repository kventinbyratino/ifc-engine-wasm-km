import test from "node:test";
import assert from "node:assert/strict";

import {
  createIfcOverrideStore,
  createOverrideKey,
} from "../../src/bim/ifc-overrides/override-store.ts";

function makeClock(...timestamps) {
  const queue = [...timestamps];
  return () => queue.shift() ?? timestamps[timestamps.length - 1];
}

test("override store normalizes property overrides and keeps them pending", () => {
  const store = createIfcOverrideStore({ now: makeClock("2026-01-01T00:00:00.000Z") });

  const override = store.setPropertyOverride({
    modelId: "model-a",
    localId: 42,
    propertySet: "Pset_WallCommon",
    propertyName: "FireRating",
    value: "EI60",
  });

  assert.equal(override.key, createOverrideKey({
    kind: "property",
    modelId: "model-a",
    localId: 42,
    propertySet: "Pset_WallCommon",
    propertyName: "FireRating",
  }));
  assert.equal(override.kind, "property");
  assert.equal(override.status, "pending");
  assert.equal(override.createdAt, "2026-01-01T00:00:00.000Z");
  assert.equal(override.updatedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(store.list().length, 1);
  assert.equal(store.snapshot().pendingCount, 1);
  assert.equal(store.snapshot().propertyCount, 1);
});

test("override store replaces class overrides with the same key", () => {
  const store = createIfcOverrideStore({ now: makeClock(
    "2026-01-01T00:00:00.000Z",
    "2026-01-01T00:01:00.000Z",
  ) });

  const created = store.setClassOverride({
    modelId: "model-a",
    localId: 7,
    fromClass: "IFCWALL",
    toClass: "IFCWALLSTANDARDCASE",
    reason: "Normalize class for downstream export",
  });
  const updated = store.setClassOverride({
    modelId: "model-a",
    localId: 7,
    fromClass: "IFCWALL",
    toClass: "IFCMEMBER",
  });

  assert.equal(created.key, updated.key);
  assert.equal(created.key, "class:model-a:7");
  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].toClass, "IFCMEMBER");
  assert.equal(store.snapshot().lastUpdatedAt, "2026-01-01T00:01:00.000Z");
  assert.equal(store.snapshot().classCount, 1);
});

test("override store can remove and clear pending changes", () => {
  const store = createIfcOverrideStore({ now: makeClock("2026-01-01T00:00:00.000Z") });

  const first = store.setPropertyOverride({
    modelId: "model-a",
    localId: 1,
    propertySet: "Pset_WallCommon",
    propertyName: "LoadBearing",
    value: true,
  });
  const second = store.setClassOverride({
    modelId: "model-a",
    localId: 2,
    fromClass: "IFCDOOR",
    toClass: "IFCWINDOW",
  });

  assert.equal(store.remove(first.key), true);
  assert.equal(store.list().length, 1);
  assert.equal(store.list()[0].key, second.key);

  store.clear();
  assert.equal(store.list().length, 0);
  assert.equal(store.snapshot().pendingCount, 0);
});
