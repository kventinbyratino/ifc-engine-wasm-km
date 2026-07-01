import test from "node:test";
import assert from "node:assert/strict";

import { loadIfcModel } from "../../src/bim/models/model-loader.ts";

test("loadIfcModel keeps the original ArrayBuffer without copying", async () => {
  const sourceBuffer = new ArrayBuffer(8);
  const file = {
    name: "sample.ifc",
    async arrayBuffer() {
      return sourceBuffer;
    },
  };

  const loadCalls = [];
  const result = await loadIfcModel({
    file,
    ifcLoader: {
      load: (...args) => {
        loadCalls.push(args);
        return Promise.resolve(undefined);
      },
    },
    onProgress: () => {},
  });

  assert.equal(loadCalls.length, 1);
  assert.strictEqual(result.sourceIfc.buffer, sourceBuffer);
});

test("loadIfcModel aborts before starting the IFC loader", async () => {
  const sourceBuffer = new ArrayBuffer(8);
  const controller = new AbortController();
  controller.abort();
  const file = {
    name: "sample.ifc",
    async arrayBuffer() {
      return sourceBuffer;
    },
  };

  let loadCalled = false;
  await assert.rejects(
    loadIfcModel({
      file,
      ifcLoader: {
        load: () => {
          loadCalled = true;
          return Promise.resolve(undefined);
        },
      },
      onProgress: () => {},
      signal: controller.signal,
    }),
    (error) => error instanceof DOMException && error.name === "AbortError",
  );
  assert.equal(loadCalled, false);
});
