import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("KM profile button has repo-local no-JS navigation fallback", () => {
  assert.match(html, /id="profileKmBtn"[\s\S]*onclick="window\.location\.assign\('\/blue\/km\/'\)"/);
});

test("KM shell starts directly without visible BIM profile picker", () => {
  assert.match(html, /<body class="profile-km" data-profile="km">/);
  assert.match(html, /<main id="app" class="profile-km" data-profile="km">/);
  assert.match(html, /id="profileScreen"[^>]+hidden/);
  assert.match(html, /id="profileBimBtn"[\s\S]*hidden[\s\S]*onclick="window\.location\.assign\('\/ifc-engine-wasm\/bim\/'\)"/);
  assert.match(html, /id="buildCommitBadge"[^>]+>%VITE_KM_BUILD_COMMIT%<\/span>/);
});

test("KM shell serves TypeScript module and WASM paths under /blue/km", () => {
  assert.match(html, /<script type="module" src="\/src\/main\.ts"><\/script>/);
  assert.doesNotMatch(html, /\/home\/maks\/projects\/IFC_engine_wasm/);
});
