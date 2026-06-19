import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const source = await readFile(new URL("../src/bim/app/ui-wiring.ts", import.meta.url), "utf8");

test("floating search button opens the search panel", () => {
  assert.match(
    source,
    /searchToggleBtn\.onclick\s*=\s*\(\)\s*=>\s*search\.toggleSearchPanel\(\);/,
  );
});

test("search panel arrow still runs the search query", () => {
  assert.match(
    source,
    /searchBtn\.onclick\s*=\s*\(\)\s*=>\s*void\s+search\.searchItems\(\);/,
  );
  assert.doesNotMatch(
    source,
    /searchBtn\.onclick\s*=\s*\(\)\s*=>\s*search\.toggleSearchPanel\(\);/,
  );
});
