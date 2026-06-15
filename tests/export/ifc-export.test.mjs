import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createIfcOverrideStore } from "../../src/bim/ifc-overrides/override-store.ts";
import { buildIfcExportPackage } from "../../src/bim/export/ifc-export.ts";

function makeRecord(overrides = {}) {
  return {
    modelId: "model-a",
    localId: 1,
    name: "Wall 01",
    category: "IFCWALL",
    globalId: "gid-1",
    typeName: "WallType",
    storey: "Level 01",
    number: "A1",
    materialName: "Concrete",
    psetCount: 1,
    searchable: "wall 01 ifcwall",
    ...overrides,
  };
}

test("buildIfcExportPackage applies property and class overrides without mutating source records", () => {
  const store = createIfcOverrideStore({ now: () => "2026-01-01T00:00:00.000Z" });
  store.setPropertyOverride({
    modelId: "model-a",
    localId: 1,
    propertySet: "Pset_WallCommon",
    propertyName: "FireRating",
    value: "EI60",
  });
  store.setClassOverride({
    modelId: "model-a",
    localId: 1,
    fromClass: "IFCWALL",
    toClass: "IFCWALLSTANDARDCASE",
  });

  const source = [makeRecord()];
  const exported = buildIfcExportPackage(source, store.list());

  assert.equal(exported.records[0].category, "IFCWALLSTANDARDCASE");
  assert.equal(exported.records[0].sourceCategory, "IFCWALL");
  assert.deepEqual(exported.records[0].appliedPropertyOverrides, [
    {
      propertySet: "Pset_WallCommon",
      propertyName: "FireRating",
      value: "EI60",
    },
  ]);
  assert.equal(source[0].category, "IFCWALL");
  assert.equal(exported.overrides.length, 2);
});

test("roundtrip fixture preserves source GUIDs and override results", async () => {
  const fixture = JSON.parse(await readFile(new URL("../fixtures/ifc/override-roundtrip.ifc", import.meta.url), "utf8"));
  const exported = buildIfcExportPackage(fixture.records, fixture.overrides);
  const reloaded = JSON.parse(JSON.stringify(exported));

  assert.equal(reloaded.records[0].globalId, fixture.records[0].globalId);
  assert.equal(reloaded.records[0].sourceCategory, "IFCWALL");
  assert.equal(reloaded.records[0].category, "IFCWALLSTANDARDCASE");
  assert.equal(reloaded.records[0].appliedPropertyOverrides[0].propertyName, "FireRating");
  assert.equal(reloaded.records[1].globalId, fixture.records[1].globalId);
  assert.equal(reloaded.records[1].category, "IFCDOOR");
});
