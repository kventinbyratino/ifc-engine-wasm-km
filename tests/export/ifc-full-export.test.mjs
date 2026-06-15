import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { IfcAPI } from "web-ifc";

import { buildFullModifiedIfcExport } from "../../src/bim/export/ifc-full-export.ts";

function makeRecord(overrides = {}) {
  return {
    modelId: "model-a",
    localId: 28,
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
    key: "property:model-a:28:Pset_WallCommon:FireRating",
    modelId: "model-a",
    localId: 28,
    propertySet: "Pset_WallCommon",
    propertyName: "FireRating",
    value: "EI90",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function classOverride(overrides = {}) {
  return {
    kind: "class",
    key: "class:model-a:28",
    modelId: "model-a",
    localId: 28,
    fromClass: "IFCWALL",
    toClass: "IFCWALLSTANDARDCASE",
    reason: "upgrade wall to standard case",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("buildFullModifiedIfcExport preserves source IFC model and appends property overrides", async () => {
  const sourceText = await readFile(new URL("../fixtures/ifc/modified-roundtrip.ifc", import.meta.url), "utf8");
  const source = new TextEncoder().encode(sourceText.replace("#28=IFCWALLSTANDARDCASE(", "#28=IFCWALL("));
  const exported = await buildFullModifiedIfcExport({
    records: [makeRecord()],
    overrides: [propertyOverride(), classOverride()],
    sources: {
      "model-a": {
        modelId: "model-a",
        fileName: "source.ifc",
        buffer: source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength),
      },
    },
    wasmPath: "./public/web-ifc/",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  const text = new TextDecoder().decode(exported.bytes);
  assert.equal(exported.fileName, "source-modified.ifc");
  assert.equal(exported.appliedPropertyOverrideCount, 1);
  assert.equal(exported.appliedClassOverrideCount, 1);
  assert.match(text, /IFCPROPERTYSINGLEVALUE\('FireRating',\$,IFCTEXT\('EI90'\),\$\);/);
  assert.match(text, /#28=IFCWALLSTANDARDCASE\('gid-1'/);
  assert.match(text, /#38=IFCRELCONTAINEDINSPATIALSTRUCTURE/);

  const ifc = new IfcAPI();
  ifc.SetWasmPath("./public/web-ifc/", true);
  await ifc.Init();
  const modelId = ifc.OpenModel(exported.bytes);
  assert.equal(ifc.IsModelOpen(modelId), true);
  assert.equal(ifc.GetMaxExpressID(modelId) > 38, true);
  ifc.CloseModel(modelId);
});

test("buildFullModifiedIfcExport rejects multi-model IFC export", async () => {
  await assert.rejects(
    buildFullModifiedIfcExport({
      records: [makeRecord(), makeRecord({ modelId: "model-b", localId: 1 })],
      overrides: [],
      sources: {},
      wasmPath: "./public/web-ifc/",
    }),
    /одну исходную IFC-модель/,
  );
});
