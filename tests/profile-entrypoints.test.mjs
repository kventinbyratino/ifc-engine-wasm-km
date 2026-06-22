import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("KM profile button has repo-local no-JS navigation fallback", () => {
  assert.match(html, /id="profileKmBtn"[\s\S]*onclick="window\.location\.assign\('\/blue\/km\/'\)"/);
});

test("KM shell serves TypeScript module and WASM paths under /blue/km", () => {
  assert.match(html, /<script type="module" src="\/src\/main\.ts"><\/script>/);
  assert.doesNotMatch(html, /\/home\/maks\/projects\/IFC_engine_wasm/);
});
