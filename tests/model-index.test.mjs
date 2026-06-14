import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-model-index-tests-"));
const srcRoot = "/home/maks/projects/IFC_engine_wasm/src/bim/data";

async function copyPatched(filename, replacements = []) {
  const source = path.join(srcRoot, filename);
  const target = path.join(tempRoot, filename);
  await mkdir(path.dirname(target), { recursive: true });
  let content = await readFile(source, "utf8");
  for (const [from, to] of replacements) content = content.replaceAll(from, to);
  await writeFile(target, content);
}

await copyPatched("extractors.ts");
await copyPatched("property-sets.ts", [["./extractors", "./extractors.ts"]]);
await copyPatched("model-reader.ts");
await copyPatched("search-index.ts");
await copyPatched("element-index.ts", [
  ["./property-sets", "./property-sets.ts"],
  ["./model-reader", "./model-reader.ts"],
  ["./search-index", "./search-index.ts"],
  ["./extractors", "./extractors.ts"],
]);
await copyPatched("model-index.ts", [
  ["./property-sets", "./property-sets.ts"],
  ["./model-reader", "./model-reader.ts"],
  ["./search-index", "./search-index.ts"],
  ["./property-extractor", "./property-extractor.ts"],
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

test("model index canonical module builds, filters and maps records", async () => {
  const item1 = {
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
  };
  const item2 = {
    Name: "Door 01",
    _category: "IFCDOOR",
    GlobalId: "GID-002",
    PredefinedType: "DOOR",
    Tag: "D1",
    Material: "Steel",
    Storey: "Level 02",
    PsetDoorCommon: { Name: "Pset_DoorCommon", _category: "IFCPROPERTYSET" },
  };
  item1.self = item1;
  item2.self = item2;

  const model = {
    async getItemsIdsWithGeometry() {
      return [11, 22];
    },
    async getItemsData(ids) {
      return ids.map((id) => (id === 11 ? item1 : item2));
    },
  };

  const records = await buildModelIndex({ fragments: { list: new Map([["model-a", model]]) } });
  assert.equal(records.length, 2);
  assert.equal(records[0].name, "Wall 01");
  assert.equal(records[0].storey, "Level 01");
  assert.equal(records[1].materialName, "Steel");

  const filtered = filterModelIndex(records, { query: "wall", category: "IFCWALL", storey: "Level 01" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].localId, 11);

  const modelIdMap = recordsToModelIdMap(records);
  assert.deepEqual([...modelIdMap["model-a"]].sort((a, b) => a - b), [11, 22]);
  assert.deepEqual(getUniqueValues(records, "storey"), ["Level 01", "Level 02"]);
});
