import test from "node:test";
import assert from "node:assert/strict";

import {
  createLodManifest,
  createSyntheticLodManifest,
  summarizeLodManifest,
} from "../../src/bim/performance/lod-manifest.ts";

test("synthetic LOD manifests preserve stable ids and fallback metadata", () => {
  const manifest = createSyntheticLodManifest({
    modelId: "tower",
    elementCount: 2_400,
    chunkSize: 1_000,
  });

  assert.equal(manifest.modelId, "tower");
  assert.equal(manifest.chunks[0].detail, "coarse");
  assert.deepEqual(manifest.chunks[0].stableElementIds, [
    { modelId: "tower", localId: 1 },
    { modelId: "tower", localId: 2 },
    { modelId: "tower", localId: 3 },
    { modelId: "tower", localId: 4 },
    { modelId: "tower", localId: 5 },
  ]);

  const summary = summarizeLodManifest(manifest);
  assert.equal(summary.totalChunks, 4);
  assert.equal(summary.coarseChunkCount, 1);
  assert.equal(summary.detailChunkCount, 3);
  assert.equal(summary.hasFallbackChunks, true);
});

test("explicit LOD manifests dedupe chunk metadata and stable ids", () => {
  const manifest = createLodManifest({
    modelId: "office",
    chunks: [
      {
        chunkId: "office:coarse",
        detail: "coarse",
        localIds: [10, 11, 11],
        floorId: "L1",
        zoneId: "core",
        categoryIds: ["IFCWALL", "IFCWALL"],
      },
      {
        chunkId: "office:detail-0",
        detail: "detail",
        stableElementIds: [
          { modelId: "office", localId: 10 },
          { modelId: "office", localId: 12 },
          { modelId: "office", localId: 12 },
        ],
      },
    ],
  });

  assert.deepEqual(manifest.chunks[0].stableElementIds, [
    { modelId: "office", localId: 10 },
    { modelId: "office", localId: 11 },
  ]);
  assert.deepEqual(manifest.chunks[0].categoryIds, ["IFCWALL"]);
  assert.equal(manifest.chunks[0].floorId, "L1");
  assert.equal(manifest.chunks[1].source, "fallback");
  assert.deepEqual(manifest.chunks[1].stableElementIds, [
    { modelId: "office", localId: 10 },
    { modelId: "office", localId: 12 },
  ]);
});
