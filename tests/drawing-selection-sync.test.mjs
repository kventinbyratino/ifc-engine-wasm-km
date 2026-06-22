import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-drawing-sync-tests-"));
const srcRoot = new URL("../src/bim", import.meta.url).pathname;

async function copyPatched(sourceRelative, targetRelative = sourceRelative, replacements = []) {
  const source = path.join(srcRoot, sourceRelative);
  const target = path.join(tempRoot, targetRelative);
  await mkdir(path.dirname(target), { recursive: true });
  let content = await readFile(source, "utf8");
  for (const [from, to] of replacements) content = content.replaceAll(from, to);
  await writeFile(target, content);
}

await copyPatched("types.ts", "types.ts");
await copyPatched("drawings/drawing-selection-sync.ts", "drawings/drawing-selection-sync.ts", [["../types", "../types.ts"]]);

const syncUrl = pathToFileURL(path.join(tempRoot, "drawings/drawing-selection-sync.ts")).href;
const {
  cloneModelIdMap,
  deserializeModelIdMap,
  findBestMatchingDrawing,
  serializeModelIdMap,
} = await import(syncUrl);

test("drawing selection sync helpers round-trip source maps", () => {
  const source = {
    A: new Set([3, 1, 2]),
    B: new Set([9]),
  };

  const serialized = serializeModelIdMap(source);
  assert.deepEqual(serialized, [["A", [1, 2, 3]], ["B", [9]]]);

  const restored = deserializeModelIdMap(serialized);
  assert.deepEqual([...restored.A], [1, 2, 3]);
  assert.deepEqual([...restored.B], [9]);

  const cloned = cloneModelIdMap(source);
  assert.notStrictEqual(cloned.A, source.A);
  assert.deepEqual([...cloned.A], [3, 1, 2]);
});

test("drawing selection sync picks the best matching drawing", () => {
  const drawings = [
    { id: "a", name: "Plan A", sourceModelIdMap: { model: new Set([1, 2, 3]) } },
    { id: "b", name: "Plan B", sourceModelIdMap: { model: new Set([2, 3, 4, 5]) } },
    { id: "c", name: "Plan C", sourceModelIdMap: { model: new Set([20]) } },
  ];

  const selection = { model: new Set([2, 3]) };
  const best = findBestMatchingDrawing(drawings, selection);

  assert.ok(best);
  assert.equal(best.drawing.id, "a");
  assert.equal(best.overlap, 2);
});
