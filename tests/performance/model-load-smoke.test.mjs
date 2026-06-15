import test from "node:test";
import assert from "node:assert/strict";

import { createPerformanceMetricCollector, evaluatePerformanceBudget, summarizeLoadPerformance } from "../../src/bim/performance/performance-metrics.ts";
import { createProgressiveLoadPlan } from "../../src/bim/performance/lod-loader.ts";
import { createVisibilityIndex } from "../../src/bim/performance/visibility-index.ts";

test("model load smoke gate combines metrics, visibility and progressive plan", () => {
  const plan = createProgressiveLoadPlan({ modelId: "demo", elementCount: 3200, chunkSize: 1000 });
  const visibility = createVisibilityIndex([
    { chunkId: "demo:0", modelId: "demo", localIds: [1, 2], box: { min: [-1, -1, -1], max: [1, 1, 1] } },
    { chunkId: "demo:1", modelId: "demo", localIds: [3], box: { min: [200, 0, 0], max: [201, 1, 1] } },
  ]).queryVisible({ position: [0, 0, 8], target: [0, 0, 0], maxDistance: 30 });

  const collector = createPerformanceMetricCollector();
  collector.mark("load-start", 0);
  collector.mark("first-visible", 300);
  collector.mark("load-complete", 900);
  collector.setCounts({ elementCount: 3200, visibleElementCount: visibility.visibleElementCount, chunkCount: plan.totalChunks });

  const gate = evaluatePerformanceBudget(summarizeLoadPerformance(collector.snapshot()), {
    maxTimeToFirstVisibleMs: 500,
    maxTotalLoadMs: 1200,
    minVisibleElementRatio: 0.0005,
  });

  assert.equal(plan.stages[0].detail, "coarse");
  assert.deepEqual(visibility.chunkIds, ["demo:0"]);
  assert.equal(gate.ok, true);
});
