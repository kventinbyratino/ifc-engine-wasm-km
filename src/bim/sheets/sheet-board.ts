import * as THREE from "three";
import type { DrawingDocument } from "../drawings/drawing-document.ts";
import { createSheetDocument } from "../drawings/drawing-document.ts";
import type { SheetFormat, SheetRecord, SheetSpecBlock } from "./sheet-types.ts";
import { SHEET_SIZES_MM } from "./sheet-types.ts";
import { buildSpecLayout } from "./spec-layout.ts";

export function createSheet(options: {
  format: SheetFormat;
  drawing: DrawingDocument;
  projectName?: string;
  title?: string;
  specBlocks?: SheetSpecBlock[];
}): SheetRecord {
  return createSheetDocument(options);
}

export function renderSheetSvg(sheet: SheetRecord) {
  const size = SHEET_SIZES_MM[sheet.format];
  const margin = Math.max(12, Math.round(size.width * 0.035));
  const titleBlockHeight = Math.max(34, Math.round(size.height * 0.15));
  const layout = buildSpecLayout({
    sheetSize: size,
    margin,
    titleBlockHeight,
    blockCount: sheet.specBlocks.length,
  });
  const viewport = layout.drawingViewport;
  const projectedLines = renderDrawingProjection(sheet.drawing, viewport);
  const drawingScale = estimateSheetScale(sheet.drawing, viewport.width, viewport.height);
  const titleTop = size.height - margin - titleBlockHeight;

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
  ${renderSpecBlocks(sheet.specBlocks, layout)}
  <rect x="${margin}" y="${titleTop}" width="${size.width - margin * 2}" height="${titleBlockHeight}" fill="#fff" stroke="#111827" stroke-width="0.5"/>
  <line x1="${margin + Math.round((size.width - margin * 2) * 0.54)}" y1="${titleTop}" x2="${margin + Math.round((size.width - margin * 2) * 0.54)}" y2="${titleTop + titleBlockHeight}" stroke="#111827" stroke-width="0.35"/>
  <line x1="${margin + Math.round((size.width - margin * 2) * 0.75)}" y1="${titleTop}" x2="${margin + Math.round((size.width - margin * 2) * 0.75)}" y2="${titleTop + titleBlockHeight}" stroke="#111827" stroke-width="0.35"/>
  <text x="${margin + 6}" y="${titleTop + 12}" font-family="Arial" font-size="6" font-weight="700" fill="#111827">${escapeXml(sheet.projectName)}</text>
  <text x="${margin + 6}" y="${titleTop + 23}" font-family="Arial" font-size="5" fill="#334155">${escapeXml(sheet.title)}</text>
  <text x="${margin + 6}" y="${titleTop + 31}" font-family="Arial" font-size="3.8" fill="#64748b">Лист оформлен для ${escapeXml(sheet.drawing.view)} · ${escapeXml(sheet.drawing.source)}</text>
  <text x="${margin + Math.round((size.width - margin * 2) * 0.54) + 6}" y="${titleTop + 12}" font-family="Arial" font-size="5" fill="#111827">Формат: ${sheet.format}</text>
  <text x="${margin + Math.round((size.width - margin * 2) * 0.54) + 6}" y="${titleTop + 23}" font-family="Arial" font-size="4" fill="#334155">Масштаб: 1:${drawingScale}</text>
  <text x="${margin + Math.round((size.width - margin * 2) * 0.54) + 6}" y="${titleTop + 31}" font-family="Arial" font-size="3.8" fill="#64748b">Чертёж: ${sheet.drawing.lineCount} линий</text>
  <text x="${margin + Math.round((size.width - margin * 2) * 0.75) + 6}" y="${titleTop + 12}" font-family="Arial" font-size="5" fill="#111827">${formatSheetDate(sheet.createdAt)}</text>
  <text x="${margin + Math.round((size.width - margin * 2) * 0.75) + 6}" y="${titleTop + 23}" font-family="Arial" font-size="4" fill="#334155">${escapeXml(sheet.drawing.view.toUpperCase())}</text>
  <text x="${margin + Math.round((size.width - margin * 2) * 0.75) + 6}" y="${titleTop + 31}" font-family="Arial" font-size="3.8" fill="#64748b">${sheet.specBlocks.length > 0 ? `Спецификаций: ${sheet.specBlocks.length}` : "Без спецификаций"}</text>
</svg>`;
}

function renderSpecBlocks(blocks: SheetSpecBlock[], layout: ReturnType<typeof buildSpecLayout>) {
  if (!layout.specArea || blocks.length === 0) return "";
  return blocks
    .map((block, index) => renderSpecBlock(block, layout.blocks[index] ?? layout.specArea!))
    .join("\n  ");
}

function renderSpecBlock(block: SheetSpecBlock, rect: { x: number; y: number; width: number; height: number }) {
  const titleHeight = 11;
  const headerHeight = 8;
  const rowHeight = 7.5;
  const tableY = rect.y + titleHeight;
  const maxRows = Math.max(0, Math.floor((rect.height - titleHeight - headerHeight - 6) / rowHeight));
  const rows = block.rows.slice(0, maxRows);
  const colA = rect.x + 4;
  const colB = rect.x + Math.round(rect.width * 0.54);
  const colC = rect.x + Math.round(rect.width * 0.79);
  const split1 = rect.x + Math.round(rect.width * 0.52);
  const split2 = rect.x + Math.round(rect.width * 0.78);

  const lines: string[] = [];
  lines.push(`<g class="sheet-spec-block" data-spec-block-id="${escapeXml(block.id)}">`);
  lines.push(`  <rect x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.width)}" height="${fmt(rect.height)}" fill="#ffffff" stroke="#0f172a" stroke-width="0.45"/>`);
  lines.push(`  <rect x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.width)}" height="${titleHeight}" fill="#e2e8f0" stroke="#0f172a" stroke-width="0.25"/>`);
  lines.push(`  <text x="${fmt(rect.x + 4)}" y="${fmt(rect.y + 7.6)}" font-family="Arial" font-size="4.5" font-weight="700" fill="#111827">${escapeXml(block.title)}</text>`);
  lines.push(`  <line x1="${fmt(split1)}" y1="${fmt(tableY)}" x2="${fmt(split1)}" y2="${fmt(rect.y + rect.height)}" stroke="#94a3b8" stroke-width="0.25"/>`);
  lines.push(`  <line x1="${fmt(split2)}" y1="${fmt(tableY)}" x2="${fmt(split2)}" y2="${fmt(rect.y + rect.height)}" stroke="#94a3b8" stroke-width="0.25"/>`);
  lines.push(`  <text x="${fmt(colA)}" y="${fmt(tableY + 5.8)}" font-family="Arial" font-size="3.4" font-weight="700" fill="#334155">Класс</text>`);
  lines.push(`  <text x="${fmt(colB)}" y="${fmt(tableY + 5.8)}" font-family="Arial" font-size="3.4" font-weight="700" fill="#334155">Этаж</text>`);
  lines.push(`  <text x="${fmt(colC)}" y="${fmt(tableY + 5.8)}" font-family="Arial" font-size="3.4" font-weight="700" fill="#334155">Кол-во</text>`);
  lines.push(`  <line x1="${fmt(rect.x)}" y1="${fmt(tableY + headerHeight)}" x2="${fmt(rect.x + rect.width)}" y2="${fmt(tableY + headerHeight)}" stroke="#94a3b8" stroke-width="0.25"/>`);

  rows.forEach((row, index) => {
    const y = tableY + headerHeight + (index + 1) * rowHeight;
    lines.push(`  <line x1="${fmt(rect.x)}" y1="${fmt(y)}" x2="${fmt(rect.x + rect.width)}" y2="${fmt(y)}" stroke="#e2e8f0" stroke-width="0.2"/>`);
    lines.push(`  <text x="${fmt(colA)}" y="${fmt(y - 2.1)}" font-family="Arial" font-size="3.5" fill="#111827">${escapeXml(row.category)}</text>`);
    lines.push(`  <text x="${fmt(colB)}" y="${fmt(y - 2.1)}" font-family="Arial" font-size="3.5" fill="#111827">${escapeXml(row.storey)}</text>`);
    lines.push(`  <text x="${fmt(colC)}" y="${fmt(y - 2.1)}" font-family="Arial" font-size="3.5" fill="#111827">${row.count}</text>`);
  });

  if (block.rows.length > rows.length) {
    lines.push(`  <text x="${fmt(rect.x + 4)}" y="${fmt(rect.y + rect.height - 3)}" font-family="Arial" font-size="3.2" fill="#64748b">+${block.rows.length - rows.length} строк</text>`);
  }

  lines.push(`</g>`);
  return lines.join("\n");
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
