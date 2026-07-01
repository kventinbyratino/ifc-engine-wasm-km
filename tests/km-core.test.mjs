import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const mainSource = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/km/app/start-km-app.ts", import.meta.url), "utf8");
const bootstrapSource = await readFile(new URL("../src/km/app/bootstrap.ts", import.meta.url), "utf8");
const coreSource = await readFile(new URL("../src/km/viewer/core.ts", import.meta.url), "utf8");
const configSource = await readFile(new URL("../src/km/config/index.ts", import.meta.url), "utf8");
const bimConfigSource = await readFile(new URL("../src/bim/config.ts", import.meta.url), "utf8");
const configModule = await import(pathToFileURL(new URL("../src/km/config/index.ts", import.meta.url).pathname).href);

test("KM entrypoint is thin and delegates to KM app module", () => {
  assert.match(mainSource, /startKmApp/);
  assert.doesNotMatch(mainSource, /\.\/bim\/app/);
  assert.match(appSource, /startKmApp/);
  assert.match(appSource, /import\("\.\/bootstrap\.ts"\)/);
  assert.doesNotMatch(appSource, /startBimApp/);
  assert.doesNotMatch(appSource, /convertLargeIfc/);
  assert.doesNotMatch(appSource, /loadKmIfcModel/);
});

test("KM bootstrap loads IFC directly in browser and keeps native file picker single-shot", () => {
  assert.match(bootstrapSource, /loadKmIfcModel/);
  assert.doesNotMatch(bootstrapSource, /convertLargeIfc/);
  assert.doesNotMatch(bootstrapSource, /emptyLoadIfcBtn\.onclick = \(\) => dom\.ifcInput\.click\(\);/);
  assert.doesNotMatch(bootstrapSource, /emptyLoadIfcBtn\.onkeydown/);
});

test("KM viewer core exposes testable viewer and loader seams", () => {
  assert.match(coreSource, /createKmViewer = createBimViewer/);
  assert.match(coreSource, /bindKmViewerLoaders/);
  assert.match(coreSource, /createKmViewerCore/);
  assert.match(coreSource, /loadIfcModel/);
  assert.match(coreSource, /loadFragBuffer/);
});

test("KM config module centralizes runtime constants and path helpers", () => {
  assert.match(configSource, /export const APP_BASE = "\/blue\/km";/);
  assert.match(configSource, /export const API_BASE = "\/ifc-engine-wasm\/api";/);
  assert.match(configSource, /export const WEB_IFC_BASE = `\$\{APP_BASE\}\/web-ifc\//);
  assert.match(configSource, /export function trimTrailingSlash/);
  assert.match(configSource, /export function createProfilePath/);
  assert.match(configSource, /export function createShareUrl/);
  assert.match(configSource, /export const KM_PROFILE_NAME = "IFC Engine KM";/);
  assert.match(bimConfigSource, /export \* from "\.\.\/km\/config\/index\.ts";/);
});

test("KM share URLs use explicit KM and BIM routes", () => {
  assert.equal(configModule.createShareUrl("km", "frag-1", "https://dev.lab-tim.ru"),
    "https://dev.lab-tim.ru/blue/km/viewer/?fragment=frag-1");
  assert.equal(configModule.createShareUrl("bim", "frag-2", "https://dev.lab-tim.ru"),
    "https://dev.lab-tim.ru/ifc-engine-wasm/bim/?fragment=frag-2");
});
