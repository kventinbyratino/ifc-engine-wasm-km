import test from "node:test";
import assert from "node:assert/strict";
import { Box3, Vector3 } from "three";

import { detectHardClashes } from "../../src/bim/clash/clash-detector.ts";
import { BBoxIndex } from "../../src/bim/spatial/bbox-index.ts";
import { getClashGroupOptions, selectClashGroup } from "../../src/bim/federation/federation.ts";

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
    searchable: "wall 01 level 01 concrete",
    ...overrides,
  };
}

function makeBox(min, max) {
  return new Box3(new Vector3(...min), new Vector3(...max));
}

function makeFragments(boxMap) {
  return {
    async getBBoxes(modelIdMap) {
      const boxes = [];
      for (const [modelId, ids] of Object.entries(modelIdMap)) {
        for (const localId of ids) {
          const box = boxMap.get(`${modelId}:${localId}`);
          if (box) boxes.push(box.clone());
        }
      }
      return boxes;
    },
  };
}

test("cross-model clash detection skips intra-model pairs and keeps model ids", async () => {
  const records = [
    makeRecord({ modelId: "model-a", localId: 1, category: "IFCWALL", name: "Wall A1", globalId: "gid-a1", searchable: "wall a1" }),
    makeRecord({ modelId: "model-a", localId: 2, category: "IFCWALL", name: "Wall A2", globalId: "gid-a2", searchable: "wall a2" }),
    makeRecord({ modelId: "model-b", localId: 3, category: "IFCPIPESEGMENT", name: "Pipe B1", globalId: "gid-b1", searchable: "pipe b1" }),
  ];
  const boxMap = new Map([
    ["model-a:1", makeBox([0, 0, 0], [1, 1, 1])],
    ["model-a:2", makeBox([0.8, 0, 0], [1.8, 1, 1])],
    ["model-b:3", makeBox([0.7, 0, 0], [1.7, 1, 1])],
  ]);
  const fragments = makeFragments(boxMap);

  const result = await detectHardClashes(fragments, {
    groupA: [records[0]],
    groupB: [records[1], records[2]],
    tolerance: 0,
    limit: 10,
    bboxIndex: new BBoxIndex(),
    crossModelOnly: true,
  });

  assert.equal(result.clashes.length, 1);
  assert.equal(result.checkedPairs, 1);
  assert.equal(result.skippedPairs, 1);
  assert.deepEqual(Object.keys(result.clashes[0].modelIdMap).sort(), ["model-a", "model-b"]);
  assert.deepEqual([...result.clashes[0].modelIdMap["model-a"]], [1]);
  assert.deepEqual([...result.clashes[0].modelIdMap["model-b"]], [3]);
});

test("discipline clash selectors are exposed for cross-model sets", () => {
  const records = [
    makeRecord({ modelId: "model-a", category: "IFCWALL", name: "Wall A" }),
    makeRecord({ modelId: "model-b", category: "IFCPIPESEGMENT", name: "Pipe B", globalId: "gid-b" }),
  ];

  const options = getClashGroupOptions(records);
  assert.deepEqual(options.disciplines.sort(), ["AR/KR", "MEP"]);
  assert.equal(selectClashGroup(records, "discipline:MEP").length, 1);
  assert.equal(selectClashGroup(records, "discipline:MEP")[0].modelId, "model-b");
});
