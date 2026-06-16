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

test("manifest-backed plans preserve chunk ordering and metadata", () => {
  const plan = createProgressiveLoadPlan({
    modelId: "manifested",
    elementCount: 2000,
    chunkSize: 1000,
    manifest: {
      modelId: "manifested",
      version: 1,
      elementCount: 2000,
      chunkSize: 1000,
      chunks: [
        { chunkId: "manifested:coarse", modelId: "manifested", detail: "coarse", localIds: [1, 2], stableElementIds: [{ modelId: "manifested", localId: 1 }, { modelId: "manifested", localId: 2 }], source: "generated", box: { min: [0, 0, 0], max: [1, 1, 1] } },
        { chunkId: "manifested:detail-0", modelId: "manifested", detail: "detail", localIds: [3, 4], stableElementIds: [{ modelId: "manifested", localId: 3 }, { modelId: "manifested", localId: 4 }], source: "backend", box: { min: [2, 0, 0], max: [3, 1, 1] } },
      ],
    },
  });

  assert.equal(plan.manifest?.chunks.length, 2);
  assert.deepEqual(plan.stages.map((stage) => stage.chunkIds), [["manifested:coarse"], ["manifested:detail-0"]]);
});
