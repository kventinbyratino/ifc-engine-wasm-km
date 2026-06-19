import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-selection-tests-"));
const source = path.join(repoRoot, "src/bim/selection/selection.ts");
const target = path.join(tempRoot, "selection.ts");
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, await readFile(source, "utf8"));
const { mergeModelIdMaps } = await import(pathToFileURL(target).href);

test("mergeModelIdMaps accumulates multi-model selections without mutating inputs", () => {
  const base = { modelA: new Set([1, 2]), modelB: new Set([5]) };
  const addition = { modelA: new Set([2, 3]), modelC: new Set([8]) };

  const merged = mergeModelIdMaps(base, addition);

  assert.deepEqual([...merged.modelA].sort((a, b) => a - b), [1, 2, 3]);
  assert.deepEqual([...merged.modelB], [5]);
  assert.deepEqual([...merged.modelC], [8]);
  assert.deepEqual([...base.modelA].sort((a, b) => a - b), [1, 2]);
  assert.deepEqual([...addition.modelA].sort((a, b) => a - b), [2, 3]);
});
