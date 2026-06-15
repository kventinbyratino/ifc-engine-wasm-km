import * as THREE from "three";
import * as OBC from "@thatopen/components";
import type { SheetRecord } from "./sheet-types.ts";
import { SHEET_SIZES_MM } from "./sheet-types.ts";

const DEFAULT_PAPER_MARGIN_MM = 10;
const TITLE_BLOCK_HEIGHT_RATIO = 0.13;
const MIN_TITLE_BLOCK_HEIGHT_MM = 32;
const VIEWPORT_PADDING_RATIO = 0.04;

type PaperViewportLayout = {
  viewport: OBC.DrawingViewport;
  x: number;
  y: number;
  width: number;
  height: number;
  paper: OBC.DxfPaperOptions;
};

export function downloadSheetDxfPaperSpace(components: OBC.Components, sheet: SheetRecord) {
  const dxf = exportSheetDxfPaperSpace(components, sheet);
  downloadText(`${sanitize(sheet.title)}-${sheet.format}-paper.dxf`, dxf, "application/dxf");
}

export function exportSheetDxfPaperSpace(components: OBC.Components, sheet: SheetRecord) {
  const dxf = components.get(OBC.DxfManager);
  const layout = ensurePaperViewport(sheet);
  return dxf.exporter.export(
    [
      {
        drawing: sheet.drawing.drawing,
        viewports: [
          {
            viewport: layout.viewport,
            x: layout.x,
            y: layout.y,
          },
        ],
      },
    ],
    layout.paper,
  );
}

function ensurePaperViewport(sheet: SheetRecord): PaperViewportLayout {
  const drawing = sheet.drawing.drawing;
  const bounds = getDrawingContentBounds(drawing);
  if (!bounds) throw new Error("Нельзя экспортировать DXF paper-space: чертёж пустой");

  const size = SHEET_SIZES_MM[sheet.format];
  const margin = DEFAULT_PAPER_MARGIN_MM;
  const titleBlockHeight = Math.max(MIN_TITLE_BLOCK_HEIGHT_MM, Math.round(size.height * TITLE_BLOCK_HEIGHT_RATIO));
  const drawingAreaWidth = size.width - margin * 2;
  const drawingAreaHeight = size.height - margin * 2;
  const viewportWidth = drawingAreaWidth;
  const viewportHeight = Math.max(1, drawingAreaHeight - titleBlockHeight);
  const paper = { widthMm: size.width, heightMm: size.height, margin };

  const viewportBounds = fitBoundsToPaperSlot(bounds, viewportWidth, viewportHeight);
  const existing = sheet.drawing.viewport
    ?? [...drawing.viewports.values()].find((viewport) => viewport.name === sheetViewportName(sheet));
  const viewport = existing ?? drawing.viewports.create({ ...viewportBounds, name: sheetViewportName(sheet) });
  viewport.left = viewportBounds.left;
  viewport.right = viewportBounds.right;
  viewport.top = viewportBounds.top;
  viewport.bottom = viewportBounds.bottom;
  viewport.drawingScale = estimateDrawingScale(viewportBounds, viewportWidth, viewportHeight);

  return {
    viewport,
    x: 0,
    y: 0,
    width: viewportWidth,
    height: viewportHeight,
    paper,
  };
}

function getDrawingContentBounds(drawing: OBC.TechnicalDrawing) {
  drawing.three.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  drawing.three.traverse((object) => {
    if (object instanceof THREE.LineSegments || object instanceof THREE.Line || object instanceof THREE.Sprite) {
      expandByObjectVertices(box, object, point);
    }
  });
  return box.isEmpty() ? null : box;
}

function expandByObjectVertices(box: THREE.Box3, object: THREE.Object3D, point: THREE.Vector3) {
  if (object instanceof THREE.Sprite) {
    box.expandByPoint(object.getWorldPosition(point));
    return;
  }

  const geometry = (object as THREE.LineSegments | THREE.Line).geometry;
  const position = geometry.getAttribute("position");
  if (!position) return;

  for (let index = 0; index < position.count; index++) {
    point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
    box.expandByPoint(point);
  }
}

function fitBoundsToPaperSlot(bounds: THREE.Box3, slotWidthMm: number, slotHeightMm: number): OBC.DrawingViewportConfig {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const contentWidth = Math.max(size.x, 0.001);
  const contentHeight = Math.max(size.z, 0.001);
  const padding = Math.max(contentWidth, contentHeight) * VIEWPORT_PADDING_RATIO;
  const paddedWidth = contentWidth + padding * 2;
  const paddedHeight = contentHeight + padding * 2;
  const slotRatio = slotWidthMm / Math.max(slotHeightMm, 1);
  const contentRatio = paddedWidth / paddedHeight;

  let width = paddedWidth;
  let height = paddedHeight;
  if (contentRatio > slotRatio) {
    height = width / slotRatio;
  } else {
    width = height * slotRatio;
  }

  return {
    left: center.x - width / 2,
    right: center.x + width / 2,
    top: -center.z + height / 2,
    bottom: -center.z - height / 2,
    scale: estimateDrawingScaleFromSize(width, height, slotWidthMm, slotHeightMm),
    name: "Paper viewport",
  };
}

function estimateDrawingScale(bounds: OBC.DrawingViewportConfig, slotWidthMm: number, slotHeightMm: number) {
  return estimateDrawingScaleFromSize(bounds.right - bounds.left, bounds.top - bounds.bottom, slotWidthMm, slotHeightMm);
}

function estimateDrawingScaleFromSize(widthModelUnits: number, heightModelUnits: number, slotWidthMm: number, slotHeightMm: number) {
  const widthScale = (widthModelUnits * 1000) / Math.max(slotWidthMm, 1);
  const heightScale = (heightModelUnits * 1000) / Math.max(slotHeightMm, 1);
  return Math.max(1, Math.ceil(Math.max(widthScale, heightScale)));
}

function sheetViewportName(sheet: SheetRecord) {
  return `Paper viewport · ${sheet.id}`;
}

function downloadText(name: string, content: string, type: string) {
  const file = new File([content], name, { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function sanitize(value: string) {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "") || "sheet";
}
