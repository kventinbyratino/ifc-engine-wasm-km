import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-drawing-projection-tests-"));
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
await copyPatched("drawings/drawing-types.ts", "drawings/drawing-types.ts");
await copyPatched("drawings/drawing-selection-sync.ts", "drawings/drawing-selection-sync.ts", [["../types.ts", "../types.ts"], ["./drawing-types.ts", "./drawing-types.ts"]]);

const syncUrl = pathToFileURL(path.join(tempRoot, "drawings/drawing-selection-sync.ts")).href;
const {
  buildProjectionSourceRefs,
  findProjectionRefsForSelection,
  getLinkedProjectionSelection,
  getProjectionSelectionStatus,
} = await import(syncUrl);

test("buildProjectionSourceRefs creates stable linked refs for every source item", () => {
  const refs = buildProjectionSourceRefs({ modelA: new Set([3, 1]), modelB: new Set([9]) }, "plan");

  assert.deepEqual(refs.map((ref) => ref.id), ["plan:modelA:1", "plan:modelA:3", "plan:modelB:9"]);
  assert.deepEqual(refs.map((ref) => ref.status), ["linked", "linked", "linked"]);
  assert.deepEqual(refs[0].source, { modelId: "modelA", localId: 1 });
});

test("projection selection helpers keep unlinked refs explicit and selectable refs isolated", () => {
  const refs = [
    ...buildProjectionSourceRefs({ modelA: new Set([1, 2]) }, "plan"),
    { id: "plan:note:unlinked", projectionType: "plan", status: "unlinked", source: null },
  ];

  const selectedRefs = findProjectionRefsForSelection(refs, { modelA: new Set([2]), modelB: new Set([7]) });
  assert.deepEqual(selectedRefs.map((ref) => ref.id), ["plan:modelA:2"]);

  assert.deepEqual(getLinkedProjectionSelection(refs[1]), { modelA: new Set([2]) });
  assert.equal(getLinkedProjectionSelection(refs[2]), null);
  assert.equal(getProjectionSelectionStatus(refs, { modelA: new Set([2]) }).status, "linked");
  assert.equal(getProjectionSelectionStatus(refs, { modelA: new Set([99]) }).status, "off-screen");
  assert.equal(getProjectionSelectionStatus([], { modelA: new Set([99]) }).status, "unlinked");
});
