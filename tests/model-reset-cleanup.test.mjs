import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const resetSource = await readFile(new URL("../src/bim/app/model-reset-service.ts", import.meta.url), "utf8");
const viewerSource = await readFile(new URL("../src/bim/viewer/viewer.ts", import.meta.url), "utf8");

test("clearModels resets viewer/data references after disposing models", () => {
  assert.match(resetSource, /resetDataIndex\(\);/);
  assert.match(resetSource, /workspace\.viewer\.lastConvertedModelId = "";/);
  assert.match(resetSource, /workspace\.viewer\.lastSourceIfcName = "";/);
  assert.match(resetSource, /workspace\.viewer\.visibleChunkIds = \[\];/);
  assert.match(resetSource, /workspace\.data\.progressiveLoadPlan = null;/);
  assert.match(resetSource, /workspace\.data\.lodManifest = null;/);
});

test("fragments worker uses the stable Vite asset URL without early blob revocation", () => {
  assert.match(viewerSource, /fragments\.init\(options\.workerUrl\);/);
  assert.doesNotMatch(viewerSource, /URL\.createObjectURL|URL\.revokeObjectURL|createFragmentsWorkerUrl/);
});
