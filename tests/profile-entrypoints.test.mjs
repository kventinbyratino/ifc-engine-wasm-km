import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile("/home/maks/projects/IFC_engine_wasm/index.html", "utf8");

test("profile buttons have no-JS navigation fallback for slow mobile startup", () => {
  assert.match(html, /id="profileKmBtn"[\s\S]*onclick="window\.location\.assign\('\/ifc-engine-wasm\/viewer\/'\)"/);
  assert.match(html, /id="profileBimBtn"[\s\S]*onclick="window\.location\.assign\('\/ifc-engine-wasm\/bim\/'\)"/);
});
