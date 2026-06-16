import test from "node:test";
import assert from "node:assert/strict";

import { createChunkCache } from "../../src/bim/performance/chunk-cache.ts";

test("chunk cache evicts least-recently-used entries within the byte budget", () => {
  const cache = createChunkCache({ maxChunks: 2, maxBytes: 100 });

  cache.set({ chunkId: "a", modelId: "m", bytes: 40, payload: { tag: "a" } });
  cache.set({ chunkId: "b", modelId: "m", bytes: 40, payload: { tag: "b" } });
  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("b"), true);

  assert.deepEqual(cache.get("a")?.payload, { tag: "a" });
  cache.set({ chunkId: "c", modelId: "m", bytes: 40, payload: { tag: "c" } });

  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("b"), false);
  assert.equal(cache.has("c"), true);

  const snapshot = cache.snapshot();
  assert.equal(snapshot.size, 2);
  assert.equal(snapshot.totalBytes, 80);
  assert.equal(snapshot.hits, 1);
  assert.equal(snapshot.evictions, 1);
});

test("chunk cache can seed manifest metadata without payloads", () => {
  const cache = createChunkCache({ maxChunks: 4, maxBytes: 200 });
  cache.seed([
    { chunkId: "tower:coarse", modelId: "tower", bytes: 10, source: "generated" },
    { chunkId: "tower:detail-0", modelId: "tower", bytes: 20, source: "backend" },
  ]);

  assert.equal(cache.has("tower:coarse"), true);
  assert.equal(cache.get("tower:detail-0")?.source, "backend");
  assert.deepEqual(cache.snapshot().chunkIds, ["tower:coarse", "tower:detail-0"]);
});
