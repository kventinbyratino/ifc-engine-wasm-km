import test from "node:test";
import assert from "node:assert/strict";

import {
  createPerformanceMetricCollector,
  evaluatePerformanceBudget,
  summarizeLoadPerformance,
} from "../../src/bim/performance/performance-metrics.ts";
import { createVisibilityIndex } from "../../src/bim/performance/visibility-index.ts";

function makeRecord(overrides = {}) {
  return {
    modelId: "model-a",
    localId: 1,
    name: "Element",
    category: "IFCWALL",
    globalId: "gid",
    typeName: "Wall",
    storey: "L1",
    number: "A1",
    materialName: "Concrete",
    psetCount: 1,
    searchable: "element",
    ...overrides,
  };
}

test("performance metrics summarize load baseline and budget regressions", () => {
  const collector = createPerformanceMetricCollector({ now: () => 1000 });
  collector.mark("load-start", 1000);
  collector.mark("first-visible", 1450);
  collector.mark("load-complete", 2200);
  collector.setCounts({ elementCount: 1200, visibleElementCount: 950, chunkCount: 8 });

  const summary = summarizeLoadPerformance(collector.snapshot());
  assert.equal(summary.timeToFirstVisibleMs, 450);
  assert.equal(summary.totalLoadMs, 1200);
  assert.equal(summary.elementCount, 1200);
  assert.equal(summary.visibleElementCount, 950);

  const result = evaluatePerformanceBudget(summary, {
    maxTimeToFirstVisibleMs: 400,
    maxTotalLoadMs: 1500,
    minVisibleElementRatio: 0.75,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.regressions, ["time-to-first-visible"]);
});

test("visibility index returns only chunks inside camera budget", () => {
  const index = createVisibilityIndex([
    { chunkId: "near", modelId: "m", localIds: [1, 2], box: { min: [0, 0, 0], max: [2, 2, 2] } },
    { chunkId: "far", modelId: "m", localIds: [3], box: { min: [100, 0, 0], max: [102, 2, 2] } },
  ]);

  const result = index.queryVisible({ position: [0, 0, 10], target: [0, 0, 0], maxDistance: 25 });
  assert.deepEqual(result.chunkIds, ["near"]);
  assert.deepEqual(result.modelIdMap, { m: new Set([1, 2]) });
});
