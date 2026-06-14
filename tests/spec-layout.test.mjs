import test from "node:test";
import assert from "node:assert/strict";

import { buildSpecLayout } from "../src/bim/sheets/spec-layout.ts";

const sheetSize = { width: 420, height: 297 };

test("buildSpecLayout reserves sidebar space when spec blocks exist", () => {
  const layout = buildSpecLayout({
    sheetSize,
    margin: 12,
    titleBlockHeight: 34,
    blockCount: 2,
  });

  assert.equal(layout.blocks.length, 2);
  assert.ok(layout.drawingViewport.width < sheetSize.width - 24);
  assert.ok(layout.specArea.width > 0);
  assert.ok(layout.blocks[0].x > layout.drawingViewport.x + layout.drawingViewport.width);
  assert.ok(layout.blocks[1].y > layout.blocks[0].y);
});

test("buildSpecLayout returns full drawing area when there are no spec blocks", () => {
  const layout = buildSpecLayout({
    sheetSize,
    margin: 12,
    titleBlockHeight: 34,
    blockCount: 0,
  });

  assert.equal(layout.blocks.length, 0);
  assert.equal(layout.specArea, null);
  assert.equal(layout.drawingViewport.width, sheetSize.width - 24);
});
