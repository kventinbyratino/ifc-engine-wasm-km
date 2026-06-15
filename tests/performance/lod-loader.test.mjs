import test from "node:test";
import assert from "node:assert/strict";

import { createProgressiveLoadPlan, runProgressiveLoadQueue } from "../../src/bim/performance/lod-loader.ts";

test("small models load as a single high detail chunk", () => {
  const plan = createProgressiveLoadPlan({ modelId: "small", elementCount: 400, chunkSize: 1000 });
  assert.deepEqual(plan.stages.map((stage) => stage.detail), ["full"]);
  assert.equal(plan.stages[0].chunkIds.length, 1);
});

test("large models load coarse chunks before detail chunks", async () => {
  const plan = createProgressiveLoadPlan({ modelId: "large", elementCount: 2500, chunkSize: 1000 });
  assert.deepEqual(plan.stages.map((stage) => stage.detail), ["coarse", "detail"]);
  assert.deepEqual(plan.stages[0].chunkIds, ["large:coarse"]);
  assert.equal(plan.stages[1].chunkIds.length, 3);

  const calls = [];
  await runProgressiveLoadQueue(plan, async (stage) => calls.push(stage.detail));
  assert.deepEqual(calls, ["coarse", "detail"]);
});
