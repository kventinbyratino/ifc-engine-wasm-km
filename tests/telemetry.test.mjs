import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

async function importTelemetry() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ifc-telemetry-"));
  const source = await readFile(path.resolve("src/bim/observability/telemetry.ts"), "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const target = path.join(tempRoot, "telemetry.mjs");
  await writeFile(target, transpiled.outputText);
  return import(target);
}

test("telemetry keeps bounded app events with sanitized error payloads", async () => {
  const { createTelemetry } = await importTelemetry();
  const sent = [];
  const telemetry = createTelemetry({
    maxEvents: 2,
    now: () => "2026-06-16T10:00:00.000Z",
    send: (event) => sent.push(event),
  });

  telemetry.track("model.load.start", { fileName: "demo.ifc" });
  telemetry.trackError("drawing.export.failed", new Error("DXF export failed"), { format: "dxf" });
  telemetry.track("sheet.export.complete", { format: "pdf" });

  assert.equal(sent.length, 3);
  assert.deepEqual(telemetry.getEvents().map((event) => event.name), [
    "drawing.export.failed",
    "sheet.export.complete",
  ]);
  assert.deepEqual(sent[1], {
    name: "drawing.export.failed",
    timestamp: "2026-06-16T10:00:00.000Z",
    severity: "error",
    payload: {
      format: "dxf",
      errorName: "Error",
      errorMessage: "DXF export failed",
    },
  });
});

test("disabled telemetry does not retain or send events", async () => {
  const { createTelemetry } = await importTelemetry();
  const sent = [];
  const telemetry = createTelemetry({ enabled: false, send: (event) => sent.push(event) });

  telemetry.track("model.load.start");
  telemetry.trackError("model.load.failed", "network down");

  assert.deepEqual(sent, []);
  assert.deepEqual(telemetry.getEvents(), []);
});
