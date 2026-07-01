import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../src/bim/app/ui-wiring.ts", import.meta.url), "utf8");

test("KM home button resets the viewer home view", () => {
  assert.match(
    source,
    /homeViewBtn\.onclick\s*=\s*\(\)\s*=>\s*void\s+model\.resetHomeView\(\);/,
  );
});

test("KM share button saves the current fragment before opening a new share link", () => {
  assert.match(source, /async function openCurrentModelShare\(\)/);
  assert.match(source, /if \(!ctx\.workspace\.viewer\.activeShareRecord\) \{\s*await library\.saveCurrentFragment\(\);\s*\}/s);
  assert.match(source, /share\.openShareModal\(\);/);
  assert.match(source, /shareModelBtn\.onclick\s*=\s*\(\)\s*=>\s*void\s+openCurrentModelShare\(\);/);
});
