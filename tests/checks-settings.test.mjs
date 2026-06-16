import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { copyPatchedModule, copyModuleFromAbsolute } from "./helpers/copy-patched-module.mjs";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-checks-settings-tests-"));
const srcRoot = "/home/maks/projects/IFC_engine_wasm/src/bim";

async function copyPatched(sourceRelative, targetRelative = sourceRelative, replacements = []) {
  await copyPatchedModule({
    srcRoot,
    tempRoot,
    sourceRelative,
    targetRelative,
    specifierMap: Object.fromEntries(replacements),
  });
}

await copyPatched("types.ts", "types.ts");
await copyPatched("checks/check-types.ts", "checks/check-types.ts", [["../types", "../types.ts"]]);
await copyPatched("checks/rule-registry.ts", "checks/rule-registry.ts", [["./check-types", "./check-types.ts"]]);
await copyPatched("checks/rule-utils.ts", "checks/rule-utils.ts", [["./check-types", "./check-types.ts"]]);
await copyPatched("checks/name-rules.ts", "checks/name-rules.ts", [["./rule-registry", "./rule-registry.ts"], ["./rule-utils", "./rule-utils.ts"]]);
await copyPatched("checks/identity-rules.ts", "checks/identity-rules.ts", [["./rule-registry", "./rule-registry.ts"], ["./rule-utils", "./rule-utils.ts"]]);
await copyPatched("checks/structure-rules.ts", "checks/structure-rules.ts", [["./rule-registry", "./rule-registry.ts"], ["./rule-utils", "./rule-utils.ts"]]);
await copyPatched("checks/material-rules.ts", "checks/material-rules.ts", [["./rule-registry", "./rule-registry.ts"], ["./rule-utils", "./rule-utils.ts"]]);
await copyPatched("checks/rules.ts", "checks/rules.ts", [
  ["./rule-registry", "./rule-registry.ts"],
  ["./name-rules", "./name-rules.ts"],
  ["./identity-rules", "./identity-rules.ts"],
  ["./structure-rules", "./structure-rules.ts"],
  ["./material-rules", "./material-rules.ts"],
]);
await copyPatched("checks/check-settings.ts", "checks/check-settings.ts", [
  ["../types", "../types.ts"],
  ["./rules", "./rules.ts"],
  ["./check-types", "./check-types.ts"],
]);

const settingsUrl = pathToFileURL(path.join(tempRoot, "checks/check-settings.ts")).href;
const rulesUrl = pathToFileURL(path.join(tempRoot, "checks/rules.ts")).href;

const {
  createDefaultChecksRuleRegistry,
  loadStoredChecksSettings,
  saveStoredChecksSettings,
  clearStoredChecksSettings,
  loadChecksRuleRegistry,
  getChecksSettingsStorageKey,
} = await import(settingsUrl);
const { listHealthRuleControls } = await import(rulesUrl);

const storage = new Map();
globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    storage.set(key, String(value));
  },
  removeItem(key) {
    storage.delete(key);
  },
  clear() {
    storage.clear();
  },
};

function controlByType(registry, type) {
  return registry.listRules().find((rule) => rule.type === type);
}

test("checks settings are saved and restored from profile-specific localStorage", () => {
  const registry = createDefaultChecksRuleRegistry();
  registry.disableRule("missing-material");
  registry.setRulePriority("missing-material", 1);
  registry.disableRule("missing-name");

  const payload = saveStoredChecksSettings("bim", registry);
  assert.ok(payload);
  assert.equal(payload.profile, "bim");
  assert.equal(storage.has(getChecksSettingsStorageKey("bim")), true);

  const loaded = loadStoredChecksSettings("bim");
  assert.ok(loaded);
  assert.equal(loaded.profile, "bim");
  assert.equal(loaded.rules.find((rule) => rule.type === "missing-material").enabled, false);
  assert.equal(loaded.rules.find((rule) => rule.type === "missing-material").priority, 1);

  const restored = loadChecksRuleRegistry("bim");
  assert.equal(controlByType(restored, "missing-material").enabled, false);
  assert.equal(controlByType(restored, "missing-material").priority, 1);
  assert.equal(controlByType(restored, "missing-name").enabled, false);
});

test("checks settings can be cleared back to defaults", () => {
  clearStoredChecksSettings("bim");
  assert.equal(loadStoredChecksSettings("bim"), null);

  const restored = loadChecksRuleRegistry("bim");
  assert.equal(controlByType(restored, "missing-material").enabled, true);
  assert.equal(controlByType(restored, "missing-name").enabled, true);
});
