import test from "node:test";
import assert from "node:assert/strict";

import { buildModelLoadReportRows, createModelLoadReport, formatCompressionPercent, formatDuration } from "../../src/bim/performance/load-report.ts";

test("load report helpers format sizes, times and compression ratio", () => {
  const report = createModelLoadReport({
    sourceName: "sample.ifc",
    ifcSizeBytes: 1024,
    fragmentSizeBytes: 256,
    conversionTimeMs: 999,
    sceneBuildTimeMs: 1200,
  });

  assert.equal(report.compressionRatio, 4);
  assert.equal(formatDuration(999), "999 мс");
  assert.equal(formatDuration(1200), "1.20 с");
  assert.equal(formatCompressionPercent(4), "75.0%");

  assert.deepEqual(buildModelLoadReportRows(report), [
    { label: "Размер IFC", value: "1.0 КБ" },
    { label: "Размер fragment", value: "256 Б" },
    { label: "Время конвертации", value: "999 мс" },
    { label: "Время построения сцены", value: "1.20 с" },
    { label: "Степень сжатия", value: "75.0%" },
  ]);
});
