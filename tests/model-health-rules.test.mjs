import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-health-tests-"));
const srcRoot = "/home/maks/projects/IFC_engine_wasm/src/bim/checks";

async function copyPatched(filename, replacements = []) {
  const source = path.join(srcRoot, filename);
  const target = path.join(tempRoot, filename);
  await mkdir(path.dirname(target), { recursive: true });
  let content = await readFile(source, "utf8");
  for (const [from, to] of replacements) content = content.replaceAll(from, to);
  await writeFile(target, content);
}

await copyPatched("rule-registry.ts");
await copyPatched("rule-utils.ts");
await copyPatched("name-rules.ts", [["./rule-registry", "./rule-registry.ts"], ["./rule-utils", "./rule-utils.ts"]]);
await copyPatched("identity-rules.ts", [["./rule-registry", "./rule-registry.ts"], ["./rule-utils", "./rule-utils.ts"]]);
await copyPatched("structure-rules.ts", [["./rule-registry", "./rule-registry.ts"], ["./rule-utils", "./rule-utils.ts"]]);
await copyPatched("material-rules.ts", [["./rule-registry", "./rule-registry.ts"], ["./rule-utils", "./rule-utils.ts"]]);
await copyPatched("rules.ts", [
  ["./rule-registry", "./rule-registry.ts"],
  ["./name-rules", "./name-rules.ts"],
  ["./identity-rules", "./identity-rules.ts"],
  ["./structure-rules", "./structure-rules.ts"],
  ["./material-rules", "./material-rules.ts"],
]);
await copyPatched("model-health.ts", [
  ["import * as OBC from \"@thatopen/components\";", "const OBC = {} as any;"],
  ["./rules", "./rules.ts"],
]);

const rulesUrl = pathToFileURL(path.join(tempRoot, "rules.ts")).href;
const modelHealthUrl = pathToFileURL(path.join(tempRoot, "model-health.ts")).href;

const {
  createDefaultModelHealthRuleRegistry,
  MODEL_HEALTH_RULE_REGISTRY,
} = await import(rulesUrl);
const { runModelHealthChecks } = await import(modelHealthUrl);

function makeRecord(overrides) {
  return {
    modelId: "model-a",
    localId: 1,
    name: "Wall 01",
    category: "IFCWALL",
    globalId: "gid-1",
    typeName: "WallType",
    storey: "Level 01",
    number: "A1",
    materialName: "Concrete",
    psetCount: 1,
    searchable: "wall 01 level 01 concrete",
    ...overrides,
  };
}

test("health rule controls are sorted by priority and show enabled state", () => {
  const controls = MODEL_HEALTH_RULE_REGISTRY.listRules();
  assert.equal(controls[0].type, "missing-name");
  assert.ok(controls.some((control) => control.type === "missing-material"));
  assert.ok(controls.every((control) => control.enabled === true));
});

test("health rule registry can toggle and reprioritize rules without mutating the source registry", () => {
  const registry = createDefaultModelHealthRuleRegistry();
  registry.disableRule("missing-material");
  assert.equal(registry.listRules().find((control) => control.type === "missing-material").enabled, false);
  assert.equal(MODEL_HEALTH_RULE_REGISTRY.listRules().find((control) => control.type === "missing-material").enabled, true);

  registry.setRulePriority("missing-material", 1);
  assert.equal(registry.listRules()[0].type, "missing-material");
});

test("runModelHealthChecks respects disabled rules and reports grouped edge cases", () => {
  const records = [
    makeRecord({
      localId: 1,
      name: "#1",
      globalId: "dup-1",
      typeName: "",
      storey: "",
      number: "",
      materialName: "",
      psetCount: 0,
      searchable: "ifcwall",
    }),
    makeRecord({
      localId: 2,
      category: "IFCDOOR",
      name: "Door 02",
      globalId: "dup-1",
      typeName: "DoorType",
      storey: "Level 01",
      number: "D1",
      materialName: "",
      psetCount: 1,
      searchable: "door 02 firerating",
    }),
    makeRecord({
      localId: 3,
      category: "IFCBUILDINGELEMENTPROXY",
      name: "Proxy 01",
      globalId: "proxy-1",
      typeName: "",
      storey: "",
      number: "",
      materialName: "",
      psetCount: 0,
      searchable: "proxy 01",
    }),
    makeRecord({
      localId: 4,
      category: "IFCSPACE",
      name: "Space 01",
      globalId: "space-1",
      typeName: "",
      storey: "Level 02",
      number: "",
      materialName: "",
      psetCount: 1,
      searchable: "space 01",
    }),
  ];

  const report = runModelHealthChecks(records);
  assert.equal(report.summary.totalElements, 4);
  assert.ok(report.issues.some((issue) => issue.type === "missing-name" && issue.localId === 1));
  assert.ok(report.issues.some((issue) => issue.type === "duplicate-global-id" && issue.localId === 1));
  assert.ok(report.issues.some((issue) => issue.type === "duplicate-global-id" && issue.localId === 2));
  assert.ok(report.issues.some((issue) => issue.type === "proxy-overuse" && issue.localId === 3));
  assert.ok(report.issues.some((issue) => issue.type === "space-missing-name-or-number" && issue.localId === 4));

  const withoutMaterialRule = createDefaultModelHealthRuleRegistry();
  withoutMaterialRule.disableRule("missing-material");

  const prunedReport = runModelHealthChecks(records, withoutMaterialRule);
  assert.equal(prunedReport.issues.some((issue) => issue.type === "missing-material"), false);
});
