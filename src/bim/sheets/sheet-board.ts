import * as THREE from "three";
import type { SheetFormat, SheetRecord } from "./sheet-types";
import { SHEET_SIZES_MM } from "./sheet-types";
import type { DrawingDocument } from "../drawings/drawing-document";
import { createSheetDocument } from "../drawings/drawing-document";

export function createSheet(options: {
  format: SheetFormat;
  drawing: DrawingDocument;
  projectName?: string;
  title?: string;
}): SheetRecord {
  return createSheetDocument(options);
}

export function renderSheetSvg(sheet: SheetRecord) {
  const size = SHEET_SIZES_MM[sheet.format];
  const margin = Math.max(12, Math.round(size.width * 0.035));
  const titleBlockHeight = Math.max(32, Math.round(size.height * 0.13));
  const viewport = {
    x: margin,
    y: margin,
    width: size.width - margin * 2,
    height: size.height - margin * 2 - titleBlockHeight,
  };
  const projectedLines = renderDrawingProjection(sheet.drawing, viewport);
  const drawingScale = estimateSheetScale(sheet.drawing, viewport.width, viewport.height);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}mm" height="${size.height}mm" viewBox="0 0 ${size.width} ${size.height}">
  <rect x="0" y="0" width="${size.width}" height="${size.height}" fill="#fff"/>
  <rect x="${margin}" y="${margin}" width="${size.width - margin * 2}" height="${size.height - margin * 2}" fill="none" stroke="#111827" stroke-width="0.5"/>
  <rect x="${viewport.x}" y="${viewport.y}" width="${viewport.width}" height="${viewport.height}" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.35"/>
  <text x="${viewport.x + 8}" y="${viewport.y + 12}" font-family="Arial" font-size="6" fill="#334155">${escapeXml(sheet.drawing.name)}</text>
  <text x="${viewport.x + 8}" y="${viewport.y + 22}" font-family="Arial" font-size="4" fill="#64748b">${sheet.drawing.lineCount} lines · ${sheet.drawing.annotations.length} annotations · scale 1:${drawingScale}</text>
  <g stroke="#0f172a" stroke-width="0.25" opacity="0.85" fill="none">
    ${projectedLines || placeholderProjectionLines(viewport.x + 10, viewport.y + 34, viewport.width - 20, viewport.height - 48)}
  </g>
  <rect x="${margin}" y="${size.height - margin - titleBlockHeight}" width="${size.width - margin * 2}" height="${titleBlockHeight}" fill="#fff" stroke="#111827" stroke-width="0.5"/>
  <line x1="${size.width - margin - 130}" y1="${size.height - margin - titleBlockHeight}" x2="${size.width - margin - 130}" y2="${size.height - margin}" stroke="#111827" stroke-width="0.35"/>
  <line x1="${size.width - margin - 65}" y1="${size.height - margin - titleBlockHeight}" x2="${size.width - margin - 65}" y2="${size.height - margin}" stroke="#111827" stroke-width="0.35"/>
  <text x="${margin + 6}" y="${size.height - margin - titleBlockHeight + 12}" font-family="Arial" font-size="6" font-weight="700" fill="#111827">${escapeXml(sheet.projectName)}</text>
  <text x="${margin + 6}" y="${size.height - margin - titleBlockHeight + 23}" font-family="Arial" font-size="5" fill="#334155">${escapeXml(sheet.title)}</text>
  <text x="${size.width - margin - 122}" y="${size.height - margin - titleBlockHeight + 12}" font-family="Arial" font-size="5" fill="#111827">Format: ${sheet.format}</text>
  <text x="${size.width - margin - 122}" y="${size.height - margin - titleBlockHeight + 23}" font-family="Arial" font-size="4" fill="#334155">Scale: 1:${drawingScale}</text>
  <text x="${size.width - margin - 58}" y="${size.height - margin - titleBlockHeight + 12}" font-family="Arial" font-size="5" fill="#111827">${formatSheetDate(sheet.createdAt)}</text>
  <text x="${size.width - margin - 58}" y="${size.height - margin - titleBlockHeight + 23}" font-family="Arial" font-size="4" fill="#334155">${escapeXml(sheet.drawing.view.toUpperCase())}</text>
</svg>`;
}

function formatSheetDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function renderDrawingProjection(drawing: DrawingDocument, viewport: { x: number; y: number; width: number; height: number }) {
  const lines = collectDrawingLines(drawing);
  if (lines.length === 0) return "";
  const box = new THREE.Box2();
  for (const line of lines) {
    box.expandByPoint(new THREE.Vector2(line.start.x, line.start.z));
    box.expandByPoint(new THREE.Vector2(line.end.x, line.end.z));
  }
  if (box.isEmpty()) return "";
  const size = box.getSize(new THREE.Vector2());
  const scale = Math.min((viewport.width - 20) / Math.max(size.x, 0.001), (viewport.height - 36) / Math.max(size.y, 0.001));
  const contentWidth = size.x * scale;
  const contentHeight = size.y * scale;
  const offsetX = viewport.x + (viewport.width - contentWidth) / 2;
  const offsetY = viewport.y + 30 + (viewport.height - 36 - contentHeight) / 2;

  return lines
    .map((line) => {
      const x1 = offsetX + (line.start.x - box.min.x) * scale;
      const y1 = offsetY + (line.start.z - box.min.y) * scale;
      const x2 = offsetX + (line.end.x - box.min.x) * scale;
      const y2 = offsetY + (line.end.z - box.min.y) * scale;
      return `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/>`;
    })
    .join("\n    ");
}

function collectDrawingLines(drawing: DrawingDocument) {
  const lines: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = [];
  drawing.drawing.three.updateWorldMatrix(true, true);
  drawing.drawing.three.traverse((object) => {
    if (!(object instanceof THREE.LineSegments)) return;
    const position = object.geometry.getAttribute("position");
    if (!position) return;
    for (let index = 0; index + 1 < position.count; index += 2) {
      lines.push({
        start: new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld),
        end: new THREE.Vector3().fromBufferAttribute(position, index + 1).applyMatrix4(object.matrixWorld),
      });
    }
  });
  return lines;
}

function estimateSheetScale(drawing: DrawingDocument, slotWidthMm: number, slotHeightMm: number) {
  const width = Math.abs(drawing.projection.bounds.right - drawing.projection.bounds.left);
  const height = Math.abs(drawing.projection.bounds.top - drawing.projection.bounds.bottom);
  const widthScale = (width * 1000) / Math.max(slotWidthMm, 1);
  const heightScale = (height * 1000) / Math.max(slotHeightMm, 1);
  return Math.max(1, Math.ceil(Math.max(widthScale, heightScale)));
}

function placeholderProjectionLines(x: number, y: number, width: number, height: number) {
  const lines: string[] = [];
  const count = 8;
  for (let index = 0; index < count; index++) {
    const px = x + (width / count) * index;
    lines.push(`<line x1="${fmt(px)}" y1="${fmt(y)}" x2="${fmt(px + width / 3)}" y2="${fmt(y + height * 0.72)}"/>`);
  }
  lines.push(`<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}" fill="none"/>`);
  return lines.join("\n    ");
}

function fmt(value: number) {
  return Number(value.toFixed(2)).toString();
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);
}
