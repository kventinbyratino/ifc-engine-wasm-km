import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const kmViewerLoaders = await import(pathToFileURL(new URL("../src/km/viewer/loaders.ts", import.meta.url).pathname).href);

test("KM viewer loader bindings inject viewer dependencies", async () => {
  const calls = [];
  const viewer = {
    ifcLoader: { tag: "ifc-loader" },
    fragments: { tag: "fragments" },
    world: { camera: { tag: "camera" } },
  };

  const loaders = kmViewerLoaders.bindKmViewerLoaders(viewer, {
    loadIfcModel: async (options) => {
      calls.push(["ifc", options]);
      return { ok: true, kind: "ifc" };
    },
    loadFragBuffer: async (options) => {
      calls.push(["frag", options]);
      return { ok: true, kind: "frag" };
    },
  });

  const ifcResult = await loaders.loadIfcModel({
    file: new File(["ifc"], "sample.ifc"),
    onProgress: () => {},
    source: { label: "sample.ifc" },
  });
  const fragResult = await loaders.loadFragBuffer({
    buffer: new ArrayBuffer(8),
    name: "sample.frag",
    onProgress: () => {},
    source: { label: "sample.frag" },
  });

  assert.deepEqual(ifcResult, { ok: true, kind: "ifc" });
  assert.deepEqual(fragResult, { ok: true, kind: "frag" });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], "ifc");
  assert.equal(calls[0][1].ifcLoader, viewer.ifcLoader);
  assert.equal(calls[1][0], "frag");
  assert.equal(calls[1][1].fragments, viewer.fragments);
  assert.equal(calls[1][1].camera, viewer.world.camera);
});
