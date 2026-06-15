import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { IfcAPI } from "web-ifc";

import { buildIfcFileExport } from "../../src/bim/data/exporters.ts";
import { buildModifiedIfcExport } from "../../src/bim/export/ifc-writer.ts";

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
    searchable: "wall 01 ifcwall gid-1",
    ...overrides,
  };
}

function propertyOverride(overrides = {}) {
  return {
    kind: "property",
    key: "property:model-a:1:Pset_WallCommon:FireRating",
    modelId: "model-a",
    localId: 1,
    propertySet: "Pset_WallCommon",
    propertyName: "FireRating",
    value: "EI60",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function classOverride(overrides = {}) {
  return {
    kind: "class",
    key: "class:model-a:1",
    modelId: "model-a",
    localId: 1,
    fromClass: "IFCWALL",
    toClass: "IFCWALLSTANDARDCASE",
    reason: "upgrade wall to standard case",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("buildModifiedIfcExport emits IFC4 STEP with preserved GUIDs and applied overrides", () => {
  const source = [
    makeRecord(),
    makeRecord({
      localId: 2,
      name: "Door 01",
      category: "IFCDOOR",
      globalId: "gid-2",
      typeName: "DoorType",
      number: "D1",
      materialName: "Steel",
      searchable: "door 01 ifcdoor gid-2",
    }),
  ];
  const exported = buildModifiedIfcExport({
    records: source,
    overrides: [propertyOverride(), classOverride()],
    fileName: "modified-roundtrip.ifc",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(exported.fileName, "modified-roundtrip.ifc");
  assert.equal(exported.recordCount, 2);
  assert.equal(exported.overrideCount, 2);
  assert.equal(exported.propertyOverrideCount, 1);
  assert.equal(exported.classOverrideCount, 1);
  assert.match(exported.content, /^ISO-10303-21;/);
  assert.match(exported.content, /FILE_SCHEMA\(\('IFC4'\)\);/);
  assert.match(exported.content, /IFCWALLSTANDARDCASE\('gid-1'/);
  assert.match(exported.content, /IFCBUILDINGELEMENTPROXY\('gid-2'/);
  assert.match(exported.content, /IFCPROPERTYSINGLEVALUE\('FireRating',\$,IFCTEXT\('EI60'\),\$\);/);
  assert.match(exported.content, /IFCRELCONTAINEDINSPATIALSTRUCTURE/);
  assert.equal(source[0].category, "IFCWALL");
});

test("data exporter facade builds the same modified IFC file contract", () => {
  const exported = buildIfcFileExport([makeRecord()], [propertyOverride()], "facade.ifc");

  assert.equal(exported.fileName, "facade.ifc");
  assert.equal(exported.content.includes("IFCPROPERTYSET"), true);
  assert.equal(exported.content.includes("gid-1"), true);
});

test("roundtrip fixture matches deterministic modified IFC output", async () => {
  const fixture = await readFile(new URL("../fixtures/ifc/modified-roundtrip.ifc", import.meta.url), "utf8");
  const source = [
    makeRecord(),
    makeRecord({
      localId: 2,
      name: "Door 01",
      category: "IFCDOOR",
      globalId: "gid-2",
      typeName: "DoorType",
      number: "D1",
      materialName: "Steel",
      searchable: "door 01 ifcdoor gid-2",
    }),
  ];

  const exported = buildModifiedIfcExport({
    records: source,
    overrides: [propertyOverride(), classOverride()],
    fileName: "modified-roundtrip.ifc",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(exported.content, fixture.trimEnd());
});

test("modified IFC fixture opens through web-ifc", async () => {
  const ifc = new IfcAPI();
  ifc.SetWasmPath("./public/web-ifc/", true);
  await ifc.Init();

  const data = new Uint8Array(await readFile(new URL("../fixtures/ifc/modified-roundtrip.ifc", import.meta.url)));
  const modelId = ifc.OpenModel(data);

  assert.equal(ifc.IsModelOpen(modelId), true);
  assert.equal(ifc.GetMaxExpressID(modelId) >= 38, true);

  ifc.CloseModel(modelId);
});
