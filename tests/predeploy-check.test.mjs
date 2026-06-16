import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { spawnSync } from "node:child_process";

const scriptPath = path.resolve("scripts/predeploy-check.mjs");

test("predeploy-check dry-run prints the release gate commands in order", () => {
  const result = spawnSync(process.execPath, [scriptPath, "--dry-run"], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /npm run build/);
  assert.match(result.stdout, /npm run smoke:regression/);
  assert.ok(result.stdout.indexOf("npm run build") < result.stdout.indexOf("npm run smoke:regression"));
});
