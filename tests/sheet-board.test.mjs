import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { createSheet, renderSheetSvg } from "../src/bim/sheets/sheet-board.ts";
import { createSpecBlocksFromRows } from "../src/bim/sheets/spec-placement.ts";
import { applySheetViewportDrag } from "../src/bim/sheets/sheet-viewport-frame.ts";

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
      sourceRefs: [
        { id: "plan:modelA:7", projectionType: "plan", status: "linked", source: { modelId: "modelA", localId: 7 } },
      ],
    },
    highlightedProjectionRefIds: ["plan:modelA:7"],
    sourceModelIdMap: new Map(),
    viewportFrame: {
      x: 16,
      y: 16,
      width: 240,
      height: 120,
    },
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
  assert.match(svg, /data-drawing-projection-ref-id="plan:modelA:7"/);
  assert.match(svg, /fill="#f97316"/);
});

test("renderSheetSvg binds projection hit areas to real drawing geometry when line metadata is available", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 10, 0, 0], 3));
  const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial());
  line.userData = { modelId: "modelA", localId: 7 };

  const drawing = createDrawingStub();
  drawing.drawing.three = new THREE.Group();
  drawing.drawing.three.add(line);
  drawing.lineCount = 1;
  const sheet = createSheet({
    format: "A3",
    drawing,
    projectName: "Проект BIM",
    title: "Геометрическая привязка",
  });

  const svg = renderSheetSvg(sheet);

  assert.match(svg, /class="drawing-projection-geometry-hit-area"/);
  assert.match(svg, /data-drawing-projection-ref-id="plan:modelA:7"/);
  assert.match(svg, /data-drawing-projection-hit-kind="geometry"/);
  assert.doesNotMatch(svg, /data-drawing-projection-hit-kind="proxy-marker"/);
});

test("viewport frame helper clamps resize and move within the sheet", () => {
  const clamped = applySheetViewportDrag({
    frame: { x: 20, y: 20, width: 120, height: 80 },
    bounds: { x: 10, y: 10, width: 200, height: 150 },
    handle: "se",
    deltaX: 200,
    deltaY: 120,
    minSize: 24,
  });

  assert.deepEqual(clamped, { x: 20, y: 20, width: 190, height: 140 });
});
