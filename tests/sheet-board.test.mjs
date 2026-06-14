import test from "node:test";
import assert from "node:assert/strict";

import { createSheet, renderSheetSvg } from "../src/bim/sheets/sheet-board.ts";
import { createSpecBlocksFromRows } from "../src/bim/sheets/spec-placement.ts";

function createDrawingStub() {
  return {
    id: "drawing-1",
    name: "План этажа",
    view: "plan",
    source: "all",
    itemCount: 0,
    lineCount: 0,
    annotations: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    drawing: {
      three: {
        updateWorldMatrix() {},
        traverse() {},
      },
    },
    viewport: null,
    projection: {
      far: 40,
      scale: 100,
      bounds: {
        min: { x: 0, y: 0, z: 0 },
        max: { x: 1, y: 1, z: 1 },
      },
    },
    sourceModelIdMap: new Map(),
    sheets: [],
  };
}

test("renderSheetSvg includes spec block tables and multiple blocks", () => {
  const sheet = createSheet({
    format: "A3",
    drawing: createDrawingStub(),
    projectName: "Проект BIM",
    title: "Лист с ведомостью",
    specBlocks: createSpecBlocksFromRows(
      [
        { category: "IFCWALL", storey: "01", count: 3 },
        { category: "IFCWINDOW", storey: "01", count: 2 },
        { category: "IFCDOOR", storey: "02", count: 4 },
      ],
      { title: "Спецификация", maxRowsPerBlock: 2 },
    ),
  });

  const svg = renderSheetSvg(sheet);

  assert.match(svg, /sheet-spec-block/);
  assert.match(svg, /Спецификация 1\/2/);
  assert.match(svg, /Спецификация 2\/2/);
  assert.match(svg, /IFCWALL/);
  assert.match(svg, /Лист с ведомостью/);
  assert.match(svg, /Спецификаций: 2/);
});
