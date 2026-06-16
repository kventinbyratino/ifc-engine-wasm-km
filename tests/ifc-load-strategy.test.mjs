import assert from "node:assert/strict";
import test from "node:test";
import { resolveIfcLoadStrategy, formatBytes } from "../src/bim/models/ifc-load-strategy.ts";

test("IFC load strategy keeps models within browser limit on the browser path", () => {
  assert.deepEqual(resolveIfcLoadStrategy({ sizeBytes: 10, maxBrowserBytes: 10 }), {
    kind: "browser",
    reason: "within-browser-limit",
  });
});

test("IFC load strategy routes oversized models to backend seam", () => {
  const strategy = resolveIfcLoadStrategy({ sizeBytes: 201 * 1024 * 1024, maxBrowserBytes: 200 * 1024 * 1024 });
  assert.equal(strategy.kind, "backend-required");
  assert.equal(strategy.reason, "exceeds-browser-limit");
  assert.match(strategy.message, /серверная конвертация/);
});

test("formatBytes uses readable binary units", () => {
  assert.equal(formatBytes(0), "0 Б");
  assert.equal(formatBytes(1024), "1 КБ");
  assert.equal(formatBytes(200 * 1024 * 1024), "200 МБ");
});
