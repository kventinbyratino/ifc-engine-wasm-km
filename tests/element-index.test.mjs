import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { copyPatchedModule, copyModuleFromAbsolute } from "./helpers/copy-patched-module.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-data-tests-"));
const srcRoot = "/home/maks/projects/IFC_engine_wasm/src/bim/data";

async function copyPatched(filename, replacements = [], sourceRoot = srcRoot) {
  await copyPatchedModule({
    srcRoot: sourceRoot,
    tempRoot,
    sourceRelative: filename,
    specifierMap: Object.fromEntries(replacements),
  });
}

await copyPatched("class-mapping.ts", [], "/home/maks/projects/IFC_engine_wasm/src/bim/ifc-overrides");

await copyPatched("extractors.ts");
await copyPatched("property-sets.ts", [["./extractors", "./extractors.ts"]]);
await copyPatched("model-reader.ts");
await copyPatched("search-index.ts");
await copyPatched("relation-types.ts");
await copyPatched("element-relations.ts", [["./property-extractor", "./property-extractor.ts"], ["./relation-types", "./relation-types.ts"]]);
await copyPatched("element-index.ts", [
  ["./relation-types", "./relation-types.ts"],
  ["./element-relations", "./element-relations.ts"],
  ["./model-index", "./model-index.ts"],
  ["./element-record-factory", "./element-record-factory.ts"],
]);
await copyPatched("element-record-factory.ts", [
  ["./element-record", "./element-record.ts"],
  ["./property-sets", "./property-sets.ts"],
  ["./search-index", "./search-index.ts"],
  ["./property-extractor", "./property-extractor.ts"],
]);
await copyPatched("model-index.ts", [
  ["./property-sets", "./property-sets.ts"],
  ["./model-reader", "./model-reader.ts"],
  ["./search-index", "./search-index.ts"],
  ["./property-extractor", "./property-extractor.ts"],
  ["./element-relations", "./element-relations.ts"],
  ["./element-record-factory", "./element-record-factory.ts"],
  ["../ifc-overrides/class-mapping.ts", "./class-mapping.ts"],
]);
await copyPatched("property-extractor.ts", [["./extractors", "./extractors.ts"]]);

const elementIndexUrl = pathToFileURL(path.join(tempRoot, "element-index.ts")).href;
const modelIndexUrl = pathToFileURL(path.join(tempRoot, "model-index.ts")).href;
const extractorsUrl = pathToFileURL(path.join(tempRoot, "extractors.ts")).href;
const propertySetsUrl = pathToFileURL(path.join(tempRoot, "property-sets.ts")).href;
const searchIndexUrl = pathToFileURL(path.join(tempRoot, "search-index.ts")).href;

const { buildElementIndex, filterElementIndex, recordsToModelIdMap } = await import(elementIndexUrl);
const { createElementRecord } = await import(pathToFileURL(path.join(tempRoot, "element-record-factory.ts")).href);
const { attr, findMaterial, findStorey, stringifyValues } = await import(extractorsUrl);
const { countPropertySets } = await import(propertySetsUrl);
const { buildSearchableIndex } = await import(searchIndexUrl);

function makeCircularItem() {
  const item = {
    Name: { value: "Wall 01" },
    _category: "IFCWALL",
    GlobalId: { value: "GID-001" },
    ObjectType: "WallType",
    Tag: "A1",
    MaterialName: "Concrete",
    Nested: {
      relation: {
        _category: "IFCBUILDINGSTOREY",
        Name: { value: "Level 01" },
      },
    },
    Pset: {
      Name: "Pset_WallCommon",
      _category: "IFCPROPERTYSET",
    },
    Extra: {
      values: ["Alpha", 123, true],
    },
  };
  item.self = item;
  return item;
}

test("extractors handle nested values and cycles", () => {
  const item = makeCircularItem();
  assert.equal(attr(item, "Name"), "Wall 01");
  assert.equal(findStorey(item), "Level 01");
  assert.equal(findMaterial(item), "Concrete");
  assert.equal(countPropertySets(item), 1);
  assert.match(stringifyValues(item), /Wall 01/);
  assert.match(stringifyValues(item), /Level 01/);
});

test("createElementRecord derives the expected model record", () => {
  const item = makeCircularItem();
  const record = createElementRecord("model-a", 11, item);

  assert.deepEqual(record, {
    modelId: "model-a",
    localId: 11,
    name: "Wall 01",
    category: "IFCWALL",
    globalId: "GID-001",
    typeName: "WallType",
    storey: "Level 01",
    number: "A1",
    materialName: "Concrete",
    psetCount: 1,
    searchable: record.searchable,
  });
  assert.match(record.searchable, /wall 01/);
  assert.match(record.searchable, /concrete/);
});

test("buildSearchableIndex normalizes tokens", () => {
  assert.equal(buildSearchableIndex(["ABC", 12, true]), "abc 12 true");
});

test("filterElementIndex matches by normalized query and exact facets", () => {
  const records = [
    {
      modelId: "m1",
      localId: 1,
      name: "Wall 01",
      category: "IFCWALL",
      globalId: "gid1",
      typeName: "WallType",
      storey: "Level 01",
      number: "A1",
      materialName: "Concrete",
      psetCount: 1,
      searchable: "wall 01 level 01 concrete",
    },
    {
      modelId: "m2",
      localId: 2,
      name: "Door 01",
      category: "IFCDOOR",
      globalId: "gid2",
      typeName: "DoorType",
      storey: "Level 02",
      number: "B1",
      materialName: "Steel",
      psetCount: 0,
      searchable: "door 01 level 02 steel",
    },
  ];

  const result = filterElementIndex(records, { query: "  wall ", category: "IFCWALL", storey: "Level 01" });
  assert.equal(result.length, 1);
  assert.equal(result[0].localId, 1);
});

test("recordsToModelIdMap groups ids by model", () => {
  const map = recordsToModelIdMap([
    {
      modelId: "m1",
      localId: 1,
      name: "Wall 01",
      category: "IFCWALL",
      globalId: "gid1",
      typeName: "WallType",
      storey: "Level 01",
      number: "A1",
      materialName: "Concrete",
      psetCount: 1,
      searchable: "wall 01",
    },
    {
      modelId: "m1",
      localId: 2,
      name: "Wall 02",
      category: "IFCWALL",
      globalId: "gid2",
      typeName: "WallType",
      storey: "Level 01",
      number: "A2",
      materialName: "Concrete",
      psetCount: 1,
      searchable: "wall 02",
    },
  ]);

  assert.deepEqual([...map.m1].sort((a, b) => a - b), [1, 2]);
});

test("buildElementIndex extracts records from model data", async () => {
  const storey = {
    Name: { value: "Level 01" },
    _category: "IFCBUILDINGSTOREY",
    GlobalId: { value: "STOREY-001" },
  };
  const item1 = makeCircularItem();
  item1.ContainedInStructure = storey;
  const item2 = {
    Name: "Door 01",
    _category: "IFCDOOR",
    GlobalId: "GID-002",
    PredefinedType: "DOOR",
    Tag: "D1",
    Material: "Steel",
    Storey: "Level 02",
    ContainedInStructure: storey,
    PsetDoorCommon: { Name: "Pset_DoorCommon", _category: "IFCPROPERTYSET" },
  };
  item2.self = item2;

  const model = {
    async getItemsIdsWithGeometry() {
      return [11, 22, 33];
    },
    async getItemsData(ids) {
      return ids.map((id) => (id === 11 ? item1 : id === 22 ? item2 : storey));
    },
  };

  const { records, relations } = await buildElementIndex({
    fragments: { list: new Map([["model-a", model]]) },
  });

  assert.equal(records.length, 3);
  assert.equal(records[0].name, "Wall 01");
  assert.equal(records[0].storey, "Level 01");
  assert.equal(records[0].psetCount, 1);
  assert.equal(records[1].name, "Door 01");
  assert.equal(records[1].storey, "Level 02");
  assert.equal(records[2].name, "Level 01");
  assert.equal(records[1].materialName, "Steel");
  assert.match(records[1].searchable, /door 01/);
  assert.equal(relations.edges.length, 2);
});
