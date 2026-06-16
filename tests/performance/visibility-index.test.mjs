import test from "node:test";
import assert from "node:assert/strict";

import { createVisibilityIndex } from "../../src/bim/performance/visibility-index.ts";

test("visibility index filters by floor and keeps selected chunks visible", () => {
  const index = createVisibilityIndex([
    {
      chunkId: "base",
      modelId: "tower",
      localIds: [1, 2],
      floorId: "L1",
      zoneId: "core",
      categoryIds: ["IFCWALL"],
      box: { min: [0, 0, 0], max: [2, 2, 2] },
    },
    {
      chunkId: "penthouse",
      modelId: "tower",
      localIds: [9],
      floorId: "L10",
      zoneId: "roof",
      categoryIds: ["IFCROOF"],
      box: { min: [200, 0, 0], max: [202, 2, 2] },
    },
  ]);

  const result = index.queryVisible({
    position: [0, 0, 8],
    target: [0, 0, 0],
    maxDistance: 20,
    floorIds: ["L1"],
    selectedElements: [{ modelId: "tower", localId: 9 }],
  });

  assert.deepEqual(result.chunkIds, ["base", "penthouse"]);
  assert.deepEqual(result.modelIdMap, { tower: new Set([1, 2, 9]) });
  assert.equal(result.visibleElementCount, 3);
});
