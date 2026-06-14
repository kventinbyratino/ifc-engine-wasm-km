import test from "node:test";
import assert from "node:assert/strict";

import { createSpecBlocksFromRows } from "../src/bim/sheets/spec-placement.ts";
import { normalizeStoredSpecBlocks, serializeSpecBlocks } from "../src/bim/sheets/spec-persistence.ts";

test("spec persistence helpers round-trip multi-block specifications", () => {
  const blocks = createSpecBlocksFromRows(
    [
      { category: "IFCWALL", storey: "01", count: 3 },
      { category: "IFCWINDOW", storey: "01", count: 2 },
      { category: "IFCDOOR", storey: "02", count: 4 },
    ],
    { title: "Спецификация", maxRowsPerBlock: 2 },
  );

  const stored = serializeSpecBlocks(blocks);
  const restored = normalizeStoredSpecBlocks(stored);

  assert.equal(restored.length, 2);
  assert.deepEqual(restored[0], stored[0]);
  assert.deepEqual(restored[1], stored[1]);
});
