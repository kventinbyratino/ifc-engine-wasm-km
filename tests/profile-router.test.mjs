import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { copyPatchedModule, copyModuleFromAbsolute } from "./helpers/copy-patched-module.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-profile-router-tests-"));
const srcRoot = new URL("../src/bim", import.meta.url).pathname;

await copyPatchedModule({
  srcRoot,
  tempRoot,
  sourceRelative: "app/profile-router.ts",
  specifierMap: {
    "../types.ts": "../types.ts",
    "./app-context.ts": "./app-context.ts",
    "../config.ts": "../../km/config/index.ts",
  },
});

await copyModuleFromAbsolute({
  source: new URL("../src/km/config/index.ts", import.meta.url).pathname,
  tempRoot: path.dirname(tempRoot),
  targetRelative: "km/config/index.ts",
});

await copyModuleFromAbsolute({
  source: new URL("../src/bim/types.ts", import.meta.url).pathname,
  tempRoot: path.dirname(tempRoot),
  targetRelative: "bim/types.ts",
});

const routerUrl = pathToFileURL(path.join(tempRoot, "app/profile-router.ts")).href;
const { createProfileRouter } = await import(routerUrl);

function createRouterHarness(initialPath = "/ifc-engine-wasm/") {
  const calls = [];
  const classSet = new Set(["profile-pending"]);
  const ctx = {
    dom: {
      app: {
        classList: {
          add: (...names) => names.forEach((name) => classSet.add(name)),
          remove: (...names) => names.forEach((name) => classSet.delete(name)),
          contains: (name) => classSet.has(name),
        },
      },
      bimStub: { hidden: true },
    },
    workspace: { viewer: { activeProfile: "pending" } },
    getCapabilities: () => ({
      dataBrowser: true,
      drawings: true,
      qaQc: true,
      issues: true,
      coordination: true,
    }),
  };

  globalThis.window = {
    location: { pathname: initialPath },
    history: {
      pushState(_state, _title, targetPath) {
        calls.push(["pushState", targetPath]);
        this.lastPath = targetPath;
        globalThis.window.location.pathname = targetPath;
      },
    },
  };

  const router = createProfileRouter({
    ctx,
    closeDataPanel: () => calls.push(["closeDataPanel"]),
    closeChecksPanel: () => calls.push(["closeChecksPanel"]),
    closeIssuesPanel: () => calls.push(["closeIssuesPanel"]),
    closeClashPanel: () => calls.push(["closeClashPanel"]),
    closeDrawingsPanel: () => calls.push(["closeDrawingsPanel"]),
    refreshModelState: () => calls.push(["refreshModelState"]),
    onProfileChange: (profile) => calls.push(["profile", profile]),
  });

  return { router, ctx, calls, classSet };
}

test("navigateToProfile switches BIM profile in-place before any reload", () => {
  const { router, ctx, calls, classSet } = createRouterHarness();

  router.navigateToProfile("bim");

  assert.equal(ctx.workspace.viewer.activeProfile, "bim");
  assert.equal(classSet.has("profile-bim"), true);
  assert.equal(classSet.has("profile-pending"), false);
  assert.deepEqual(calls[0], ["pushState", "/ifc-engine-wasm/bim/"]);
  assert.deepEqual(calls.at(-1), ["profile", "bim"]);
});

test("syncProfileWithLocation selects BIM profile on direct /bim route", () => {
  const { router, ctx, classSet } = createRouterHarness("/ifc-engine-wasm/bim/");

  router.syncProfileWithLocation();

  assert.equal(ctx.workspace.viewer.activeProfile, "bim");
  assert.equal(classSet.has("profile-bim"), true);
});
