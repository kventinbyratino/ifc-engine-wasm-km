import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { copyPatchedModule, copyModuleFromAbsolute } from "./helpers/copy-patched-module.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-model-index-tests-"));
const srcRoot = new URL("../src/bim/data", import.meta.url).pathname;

async function copyPatched(filename, replacements = [], sourceRoot = srcRoot) {
  await copyPatchedModule({
    srcRoot: sourceRoot,
    tempRoot,
    sourceRelative: filename,
    specifierMap: Object.fromEntries(replacements),
  });
}

await copyPatched("class-mapping.ts", [], new URL("../src/bim/ifc-overrides", import.meta.url).pathname);

await copyPatched("extractors.ts");
await copyPatched("property-sets.ts", [["./extractors", "./extractors.ts"]]);
await copyPatched("model-reader.ts");
await copyPatched("search-index.ts");
await copyPatched("relation-types.ts");
await copyPatched("element-relations.ts", [["./property-extractor", "./property-extractor.ts"], ["./relation-types", "./relation-types.ts"]]);
await copyPatched("element-index.ts", [
  ["./relation-types", "./relation-types.ts"],
  ["./property-sets", "./property-sets.ts"],
  ["./model-reader", "./model-reader.ts"],
  ["./search-index", "./search-index.ts"],
  ["./extractors", "./extractors.ts"],
]);
await copyPatched("element-record.ts");
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

const modelIndexUrl = pathToFileURL(path.join(tempRoot, "model-index.ts")).href;
const propertyExtractorUrl = pathToFileURL(path.join(tempRoot, "property-extractor.ts")).href;

const {
  buildModelIndex,
  filterModelIndex,
  recordsToModelIdMap,
  getUniqueValues,
} = await import(modelIndexUrl);
const { attr, findMaterial, findStorey, stringifyValues } = await import(propertyExtractorUrl);

test("property extractor canonical module exposes nested property helpers", () => {
  const item = {
    Name: { value: "Wall 01" },
    _category: "IFCWALL",
    MaterialName: "Concrete",
    Nested: {
      relation: {
        _category: "IFCBUILDINGSTOREY",
        Name: { value: "Level 01" },
      },
    },
  };

  assert.equal(attr(item, "Name"), "Wall 01");
  assert.equal(findStorey(item), "Level 01");
  assert.equal(findMaterial(item), "Concrete");
  assert.match(stringifyValues(item), /Wall 01/);
});

test("model index times out when item data lookup stalls", async () => {
  const model = {
    async getItemsIdsWithGeometry() {
      return [11];
    },
    getItemsData() {
      return new Promise(() => {});
    },
  };

  await assert.rejects(
    buildModelIndex({ fragments: { list: new Map([["model-a", model]]) }, itemReadTimeoutMs: 10 }),
    /Не удалось прочитать свойства модели model-a за 10 мс/,
  );
});

test("model index canonical module builds, filters and maps records", async () => {
  const storey = {
    Name: { value: "Level 01" },
    _category: "IFCBUILDINGSTOREY",
    GlobalId: { value: "STOREY-001" },
    Tag: "S1",
  };
  const item1 = {
    Name: { value: "Wall 01" },
    _category: "IFCWALL",
    GlobalId: { value: "GID-001" },
    ObjectType: "WallType",
    Tag: "A1",
    MaterialName: "Concrete",
    ContainedInStructure: storey,
    Pset: {
      Name: "Pset_WallCommon",
      _category: "IFCPROPERTYSET",
    },
  };
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
  item1.self = item1;
  item2.self = item2;
  storey.self = storey;

  const model = {
    async getItemsIdsWithGeometry() {
      return [11, 22, 33];
    },
    async getItemsData(ids) {
      return ids.map((id) => (id === 11 ? item1 : id === 22 ? item2 : storey));
    },
  };

  const { records, relations } = await buildModelIndex({ fragments: { list: new Map([["model-a", model]]) } });
  assert.equal(records.length, 3);
  assert.equal(records[0].name, "Wall 01");
  assert.equal(records[0].storey, "Level 01");
  assert.equal(records[1].materialName, "Steel");
  assert.equal(records[2].name, "Level 01");

  const filtered = filterModelIndex(records, { query: "wall", category: "IFCWALL", storey: "Level 01" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].localId, 11);

  const modelIdMap = recordsToModelIdMap(records);
  assert.deepEqual([...modelIdMap["model-a"]].sort((a, b) => a - b), [11, 22, 33]);
  assert.deepEqual(getUniqueValues(records, "storey"), ["Level 01", "Level 02"]);
  assert.equal(relations.edges.length, 2);
  assert.ok(relations.outgoing["model-a:11"].some((edge) => edge.type === "hosted_by"));
  assert.ok(relations.outgoing["model-a:22"].some((edge) => edge.type === "hosted_by"));
});
