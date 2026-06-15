import test from "node:test";
import assert from "node:assert/strict";

import { MODEL_CACHE_SCHEMA_VERSION } from "../../src/bim/storage/indexeddb-schema.ts";
import { createMemoryModelCache, createModelCacheKey } from "../../src/bim/storage/model-cache.ts";

test("model cache stores chunks with schema versioned keys", async () => {
  const cache = createMemoryModelCache();
  const key = createModelCacheKey({ sourceKey: "frag:alpha", chunkId: "chunk-1", schemaVersion: MODEL_CACHE_SCHEMA_VERSION });
  const payload = new Uint8Array([1, 2, 3]).buffer;

  await cache.putChunk(key, payload, { modelId: "alpha", byteLength: 3 });
  const restored = await cache.getChunk(key);

  assert.equal(restored?.metadata.modelId, "alpha");
  assert.equal(restored?.metadata.schemaVersion, MODEL_CACHE_SCHEMA_VERSION);
  assert.deepEqual([...new Uint8Array(restored?.buffer)], [1, 2, 3]);
});

test("model cache can invalidate stale schema versions", async () => {
  const cache = createMemoryModelCache();
  await cache.putChunk(createModelCacheKey({ sourceKey: "a", chunkId: "1", schemaVersion: 0 }), new Uint8Array([1]).buffer);
  await cache.putChunk(createModelCacheKey({ sourceKey: "a", chunkId: "2", schemaVersion: MODEL_CACHE_SCHEMA_VERSION }), new Uint8Array([2]).buffer);

  const removed = await cache.clearStaleVersions(MODEL_CACHE_SCHEMA_VERSION);
  assert.equal(removed, 1);
  assert.equal(await cache.getChunk(createModelCacheKey({ sourceKey: "a", chunkId: "1", schemaVersion: 0 })), null);
});
