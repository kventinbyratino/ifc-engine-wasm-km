import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const scriptPath = path.resolve("scripts/smoke-regression.mjs");

test("smoke-regression validates a built Vite dist and required BIM routes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ifc-smoke-ok-"));
  const dist = path.join(root, "dist");
  await mkdir(path.join(dist, "assets"), { recursive: true });
  await writeFile(path.join(dist, "index.html"), [
    "<!doctype html>",
    "<div id=\"app\" data-route=\"/ifc-engine-wasm/bim/\"></div>",
    "<script type=\"module\" src=\"/assets/index-demo.js\"></script>",
    "<link rel=\"stylesheet\" href=\"/assets/index-demo.css\">",
  ].join("\n"));
  await writeFile(path.join(dist, "assets/index-demo.js"), "console.log('Чертёж Размер Выноска');");
  await writeFile(path.join(dist, "assets/index-demo.css"), ".viewer-shell{display:block}");

  const result = spawnSync(process.execPath, [scriptPath, "--dist", dist], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /smoke-regression ok/);
});

test("smoke-regression fails when built assets miss drawing runtime markers", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ifc-smoke-bad-"));
  const dist = path.join(root, "dist");
  await mkdir(path.join(dist, "assets"), { recursive: true });
  await writeFile(path.join(dist, "index.html"), "<div id=\"app\"></div><script type=\"module\" src=\"/assets/index-demo.js\"></script>");
  await writeFile(path.join(dist, "assets/index-demo.js"), "console.log('viewer only');");

  const result = spawnSync(process.execPath, [scriptPath, "--dist", dist], { encoding: "utf8" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing drawing runtime marker/i);
});
