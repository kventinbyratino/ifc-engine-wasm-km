import test from "node:test";
import assert from "node:assert/strict";
import { Box3, Vector3 } from "three";
import { getCandidatePairs } from "../src/bim/clash/broad-phase.ts";
import { createClashRecord, getClashSeverity, sortClashRecords } from "../src/bim/clash/clash-report.ts";
import { getOverlapBox, getOverlapVolume } from "../src/bim/clash/overlap.ts";

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

function makeBoxItem(id, min, max) {
  return {
    record: makeRecord({ localId: id, name: `Item ${id}`, globalId: `gid-${id}` }),
    box: makeBox(min, max),
  };
}

test("broad phase candidate generation respects tolerance on x axis", () => {
  const a = [makeBoxItem(1, [0, 0, 0], [1, 1, 1])];
  const b = [
    makeBoxItem(2, [1.08, 0, 0], [2, 1, 1]),
    makeBoxItem(3, [3, 0, 0], [4, 1, 1]),
  ];

  assert.equal(getCandidatePairs(a, b, 0).length, 0);
  const tolerantPairs = getCandidatePairs(a, b, 0.1);
  assert.equal(tolerantPairs.length, 1);
  assert.equal(tolerantPairs[0][0].record.localId, 1);
  assert.equal(tolerantPairs[0][1].record.localId, 2);
});

test("overlap engine returns exact box intersection and volume", () => {
  const overlap = getOverlapBox(
    makeBox([0, 0, 0], [2, 2, 2]),
    makeBox([1, 1, 1], [3, 3, 3]),
  );

  assert.ok(overlap);
  assert.deepEqual(overlap.min.toArray(), [1, 1, 1]);
  assert.deepEqual(overlap.max.toArray(), [2, 2, 2]);
  assert.equal(getOverlapVolume(makeBox([0, 0, 0], [1, 1, 1]), makeBox([2, 2, 2], [3, 3, 3])), 0);
  assert.equal(getOverlapVolume(makeBox([0, 0, 0], [2, 2, 2]), makeBox([1, 1, 1], [3, 3, 3])), 1);
});

test("clash report formats severity, ids and sorting independently of geometry", () => {
  const a = makeRecord({ modelId: "model-a", localId: 11, name: "Wall A" });
  const b = makeRecord({ modelId: "model-b", localId: 22, name: "Pipe B" });
  const clash = createClashRecord(a, b, 0.75);

  assert.equal(clash.id, "clash-model-a-11-model-b-22");
  assert.equal(clash.title, "IFCWALL × IFCWALL");
  assert.equal(clash.severity, "critical");
  assert.equal(clash.description.includes("0.7500 m³") || clash.description.includes("0.75 m³"), true);
  assert.deepEqual([...clash.modelIdMap["model-a"]], [11]);
  assert.deepEqual([...clash.modelIdMap["model-b"]], [22]);
  assert.equal(getClashSeverity(0.01), "info");
  assert.equal(getClashSeverity(0.2), "warning");
  assert.equal(getClashSeverity(0.8), "critical");

  const sorted = sortClashRecords([
    createClashRecord(a, b, 0.1),
    createClashRecord(a, b, 1.2),
    createClashRecord(a, b, 0.5),
  ]);
  assert.deepEqual(sorted.map((item) => item.overlapVolume), [1.2, 0.5, 0.1]);
});
