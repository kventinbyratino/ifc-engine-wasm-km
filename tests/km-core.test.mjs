import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const mainSource = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/km/app/start-km-app.ts", import.meta.url), "utf8");
const coreSource = await readFile(new URL("../src/km/viewer/core.ts", import.meta.url), "utf8");
const configSource = await readFile(new URL("../src/km/config/index.ts", import.meta.url), "utf8");

test("KM entrypoint is thin and delegates to KM app module", () => {
  assert.match(mainSource, /startKmApp/);
  assert.doesNotMatch(mainSource, /\.\/bim\/app/);
  assert.match(appSource, /startBimApp/);
});

test("KM viewer core exposes testable viewer and loader seams", () => {
  assert.match(coreSource, /createBimViewer as createKmViewer/);
  assert.match(coreSource, /loadIfcModel/);
  assert.match(coreSource, /loadFragBuffer/);
});

test("KM config module re-exports runtime constants", () => {
  assert.match(configSource, /APP_BASE/);
  assert.match(configSource, /WEB_IFC_BASE/);
  assert.match(configSource, /KM_PROFILE_NAME/);
});
