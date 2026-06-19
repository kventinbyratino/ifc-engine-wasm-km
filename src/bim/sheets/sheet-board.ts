import * as THREE from "three";
import type { DrawingDocument } from "../drawings/drawing-document.ts";
import { createSheetDocument } from "../drawings/drawing-document.ts";
import type { SheetFormat, SheetRecord, SheetSpecBlock } from "./sheet-types.ts";
import { SHEET_SIZES_MM } from "./sheet-types.ts";
import { buildSpecLayout } from "./spec-layout.ts";
import { applySheetViewportDrag, cloneSheetViewportFrame, normalizeSheetViewportFrame, type SheetViewportFrame, type SheetViewportHandle } from "./sheet-viewport-frame.ts";

export function createSheet(options: {
  format: SheetFormat;
  drawing: DrawingDocument;
  projectName?: string;
  title?: string;
  specBlocks?: SheetSpecBlock[];
}): SheetRecord {
  const size = SHEET_SIZES_MM[options.format];
  const margin = Math.max(12, Math.round(size.width * 0.035));
  const titleBlockHeight = Math.max(34, Math.round(size.height * 0.15));
  const layout = buildSpecLayout({
    sheetSize: size,
    margin,
    titleBlockHeight,
    blockCount: options.specBlocks?.length ?? 0,
  });

  return createSheetDocument({
    ...options,
    viewportFrame: cloneSheetViewportFrame(layout.drawingViewport),
  });
}

export function renderSheetSvg(sheet: SheetRecord, options: { includeViewportHandles?: boolean } = {}) {
  const size = SHEET_SIZES_MM[sheet.format];
  const margin = Math.max(12, Math.round(size.width * 0.035));
  const titleBlockHeight = Math.max(34, Math.round(size.height * 0.15));
  const layout = buildSpecLayout({
    sheetSize: size,
    margin,
    titleBlockHeight,
    blockCount: sheet.specBlocks.length,
  });
  const viewport = normalizeSheetViewportFrame(sheet.viewportFrame, layout.drawingViewport, 24);
  const projected = renderDrawingProjection(sheet.drawing, viewport);
  const projectionMarkers = renderProjectionSourceMarkers(sheet.drawing, viewport, projected.geometryRefIds);
  const drawingScale = estimateSheetScale(sheet.drawing, viewport.width, viewport.height);
  const titleTop = size.height - margin - titleBlockHeight;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}mm" height="${size.height}mm" viewBox="0 0 ${size.width} ${size.height}">
  <rect x="0" y="0" width="${size.width}" height="${size.height}" fill="#fff"/>
  <rect x="${margin}" y="${margin}" width="${size.width - margin * 2}" height="${size.height - margin * 2}" fill="none" stroke="#111827" stroke-width="0.5"/>
  <rect x="${viewport.x}" y="${viewport.y}" width="${viewport.width}" height="${viewport.height}" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.35"/>
  ${options.includeViewportHandles ? renderViewportHandles(viewport, size) : ""}
  <text x="${viewport.x + 8}" y="${viewport.y + 12}" font-family="Arial" font-size="6" fill="#334155">${escapeXml(sheet.drawing.name)}</text>
  <text x="${viewport.x + 8}" y="${viewport.y + 22}" font-family="Arial" font-size="4" fill="#64748b">${sheet.drawing.lineCount} lines · ${sheet.drawing.annotations.length} annotations · scale 1:${drawingScale}</text>
  <g stroke="#0f172a" stroke-width="0.25" opacity="0.85" fill="none">
    ${projected.svg || placeholderProjectionLines(viewport.x + 10, viewport.y + 34, viewport.width - 20, viewport.height - 48)}
  </g>
  ${projectionMarkers}
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

function renderViewportHandles(frame: SheetViewportFrame, size: { width: number; height: number }) {
  const handleSize = Math.max(4, Math.min(8, Math.round(Math.min(size.width, size.height) * 0.012)));
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  const points: Array<[SheetViewportHandle, number, number, string]> = [
    ["move", frame.x, frame.y, "move"],
    ["nw", frame.x, frame.y, "nw-resize"],
    ["n", centerX, frame.y, "n-resize"],
    ["ne", frame.x + frame.width, frame.y, "ne-resize"],
    ["e", frame.x + frame.width, centerY, "e-resize"],
    ["se", frame.x + frame.width, frame.y + frame.height, "se-resize"],
    ["s", centerX, frame.y + frame.height, "s-resize"],
    ["sw", frame.x, frame.y + frame.height, "sw-resize"],
    ["w", frame.x, centerY, "w-resize"],
  ];

  const lines = [`<g class="sheet-viewport-frame" data-sheet-viewport-frame="true">`];
  lines.push(`  <rect x="${fmt(frame.x)}" y="${fmt(frame.y)}" width="${fmt(frame.width)}" height="${fmt(frame.height)}" fill="#2563eb" fill-opacity="0.05" stroke="#2563eb" stroke-width="0.55" stroke-dasharray="2 1.4" pointer-events="all" data-sheet-viewport-handle="move" data-sheet-viewport-cursor="move"/>`);

  for (const [handle, x, y, cursor] of points.slice(1)) {
    lines.push(`  <rect x="${fmt(x - handleSize / 2)}" y="${fmt(y - handleSize / 2)}" width="${fmt(handleSize)}" height="${fmt(handleSize)}" rx="1.1" ry="1.1" fill="#2563eb" stroke="#ffffff" stroke-width="0.35" pointer-events="all" data-sheet-viewport-handle="${handle}" data-sheet-viewport-cursor="${cursor}"/>`);
  }

  lines.push(`</g>`);
  return lines.join("\n  ");
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

function renderDrawingProjection(drawing: DrawingDocument, viewport: SheetViewportFrame) {
  const sourceRefs = buildProjectionSourceRefLookup(drawing);
  const lines = collectDrawingLines(drawing, sourceRefs);
  if (lines.length === 0) return { svg: "", geometryRefIds: new Set<string>() };
  const box = new THREE.Box2();
  for (const line of lines) {
    box.expandByPoint(new THREE.Vector2(line.start.x, line.start.z));
    box.expandByPoint(new THREE.Vector2(line.end.x, line.end.z));
  }
  if (box.isEmpty()) return { svg: "", geometryRefIds: new Set<string>() };
  const size = box.getSize(new THREE.Vector2());
  const scale = Math.min((viewport.width - 20) / Math.max(size.x, 0.001), (viewport.height - 36) / Math.max(size.y, 0.001));
  const contentWidth = size.x * scale;
  const contentHeight = size.y * scale;
  const offsetX = viewport.x + (viewport.width - contentWidth) / 2;
  const offsetY = viewport.y + 30 + (viewport.height - 36 - contentHeight) / 2;
  const highlighted = new Set(drawing.highlightedProjectionRefIds ?? []);
  const geometryRefIds = new Set<string>();

  const svg = lines
    .map((line) => {
      const x1 = offsetX + (line.start.x - box.min.x) * scale;
      const y1 = offsetY + (line.start.z - box.min.y) * scale;
      const x2 = offsetX + (line.end.x - box.min.x) * scale;
      const y2 = offsetY + (line.end.z - box.min.y) * scale;
      const active = line.refId ? highlighted.has(line.refId) : false;
      const visibleStroke = active ? ` stroke="#f97316" stroke-width="0.7"` : "";
      const visibleLine = `<line x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}"${visibleStroke}/>`;
      if (!line.refId) return visibleLine;

      geometryRefIds.add(line.refId);
      const status = sourceRefs.byId.get(line.refId)?.status ?? "linked";
      return `${visibleLine}\n    <line class="drawing-projection-geometry-hit-area" x1="${fmt(x1)}" y1="${fmt(y1)}" x2="${fmt(x2)}" y2="${fmt(y2)}" stroke="#f97316" stroke-opacity="0" stroke-width="5" pointer-events="stroke" data-drawing-projection-ref-id="${escapeXml(line.refId)}" data-drawing-projection-status="${status}" data-drawing-projection-hit-kind="geometry"/>`;
    })
    .join("\n    ");
  return { svg, geometryRefIds };
}

function collectDrawingLines(drawing: DrawingDocument, sourceRefs: ProjectionSourceRefLookup) {
  const lines: Array<{ start: THREE.Vector3; end: THREE.Vector3; refId?: string }> = [];
  drawing.drawing.three.updateWorldMatrix(true, true);
  drawing.drawing.three.traverse((object) => {
    if (!(object instanceof THREE.LineSegments)) return;
    const position = object.geometry.getAttribute("position");
    if (!position) return;
    const singleRefId = sourceRefs.byId.size === 1 ? [...sourceRefs.byId.keys()][0] : null;
    const objectRefId = resolveProjectionRefId(object.userData, sourceRefs) ?? resolveProjectionRefId(object.geometry.userData, sourceRefs) ?? singleRefId;
    const segmentRefs = Array.isArray(object.userData?.projectionSourceRefs)
      ? object.userData.projectionSourceRefs
      : Array.isArray(object.geometry.userData?.projectionSourceRefs)
        ? object.geometry.userData.projectionSourceRefs
        : [];
    for (let index = 0; index + 1 < position.count; index += 2) {
      const segmentRefId = resolveProjectionRefId(segmentRefs[index / 2], sourceRefs) ?? objectRefId;
      lines.push({
        start: new THREE.Vector3().fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld),
        end: new THREE.Vector3().fromBufferAttribute(position, index + 1).applyMatrix4(object.matrixWorld),
        refId: segmentRefId ?? undefined,
      });
    }
  });
  return lines;
}

type ProjectionSourceRefLookup = ReturnType<typeof buildProjectionSourceRefLookup>;

function buildProjectionSourceRefLookup(drawing: DrawingDocument) {
  const byId = new Map<string, DrawingDocument["projection"]["sourceRefs"][number]>();
  const bySource = new Map<string, string>();
  for (const ref of drawing.projection.sourceRefs ?? []) {
    byId.set(ref.id, ref);
    if (ref.source) bySource.set(getSourceKey(ref.source.modelId, ref.source.localId), ref.id);
  }
  return { byId, bySource };
}

function resolveProjectionRefId(value: unknown, sourceRefs: ProjectionSourceRefLookup) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const directId = stringValue(record.projectionRefId) ?? stringValue(record.sourceRefId) ?? stringValue(record.refId) ?? stringValue(record.drawingProjectionRefId);
  if (directId && sourceRefs.byId.has(directId)) return directId;

  const modelId = stringValue(record.modelId) ?? stringValue(record.ModelId);
  const localId = numberValue(record.localId) ?? numberValue(record.LocalId) ?? numberValue(record.expressId) ?? numberValue(record.ExpressId) ?? numberValue(record.id) ?? numberValue(record.Id);
  if (!modelId || localId === null) return null;
  return sourceRefs.bySource.get(getSourceKey(modelId, localId)) ?? null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function getSourceKey(modelId: string, localId: number) {
  return `${modelId}:${localId}`;
}

function renderProjectionSourceMarkers(drawing: DrawingDocument, viewport: SheetViewportFrame, geometryRefIds: Set<string>) {
  const refs = (drawing.projection.sourceRefs ?? []).filter((ref) => !geometryRefIds.has(ref.id));
  if (refs.length === 0) return "";

  const highlighted = new Set(drawing.highlightedProjectionRefIds ?? []);
  const visibleRefs = refs.slice(0, 80);
  const cols = Math.max(1, Math.ceil(Math.sqrt(visibleRefs.length)));
  const rows = Math.max(1, Math.ceil(visibleRefs.length / cols));
  const left = viewport.x + 12;
  const top = viewport.y + 34;
  const width = Math.max(1, viewport.width - 24);
  const height = Math.max(1, viewport.height - 48);
  const markerSize = Math.max(3, Math.min(7, Math.min(width / cols, height / rows) * 0.32));

  const markers = visibleRefs.map((ref, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = left + ((col + 0.5) / cols) * width;
    const y = top + ((row + 0.5) / rows) * height;
    const active = highlighted.has(ref.id);
    const fill = ref.status === "linked" ? (active ? "#f97316" : "#2563eb") : "#94a3b8";
    const stroke = active ? "#7c2d12" : "#ffffff";
    const opacity = active ? "0.95" : "0.34";
    return `<rect x="${fmt(x - markerSize / 2)}" y="${fmt(y - markerSize / 2)}" width="${fmt(markerSize)}" height="${fmt(markerSize)}" rx="${fmt(markerSize * 0.25)}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}" stroke-width="0.45" pointer-events="all" data-drawing-projection-ref-id="${escapeXml(ref.id)}" data-drawing-projection-status="${ref.status}" data-drawing-projection-hit-kind="proxy-marker"/>`;
  });

  return `<g class="drawing-projection-source-markers" data-drawing-projection-markers="true">\n    ${markers.join("\n    ")}\n  </g>`;
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
