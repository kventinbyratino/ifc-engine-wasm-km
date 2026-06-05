import type { SheetFormat, SheetRecord } from "./sheet-types";
import { SHEET_SIZES_MM } from "./sheet-types";
import type { DrawingRecord } from "../drawings/drawings-panel";

export function createSheet(options: {
  format: SheetFormat;
  drawing: DrawingRecord;
  projectName?: string;
  title?: string;
}): SheetRecord {
  return {
    id: `sheet-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    format: options.format,
    title: options.title || options.drawing.name,
    projectName: options.projectName || "BIM Manager Workbench",
    drawing: options.drawing,
    createdAt: new Date(),
  };
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

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}mm" height="${size.height}mm" viewBox="0 0 ${size.width} ${size.height}">
  <rect x="0" y="0" width="${size.width}" height="${size.height}" fill="#fff"/>
  <rect x="${margin}" y="${margin}" width="${size.width - margin * 2}" height="${size.height - margin * 2}" fill="none" stroke="#111827" stroke-width="0.5"/>
  <rect x="${viewport.x}" y="${viewport.y}" width="${viewport.width}" height="${viewport.height}" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.35"/>
  <text x="${viewport.x + 8}" y="${viewport.y + 12}" font-family="Arial" font-size="6" fill="#334155">${escapeXml(sheet.drawing.name)}</text>
  <text x="${viewport.x + 8}" y="${viewport.y + 22}" font-family="Arial" font-size="4" fill="#64748b">${sheet.drawing.lineCount} lines · ${sheet.drawing.annotations.length} annotations</text>
  <g stroke="#0f172a" stroke-width="0.25" opacity="0.75">
    ${placeholderProjectionLines(viewport.x + 10, viewport.y + 34, viewport.width - 20, viewport.height - 48)}
  </g>
  <rect x="${margin}" y="${size.height - margin - titleBlockHeight}" width="${size.width - margin * 2}" height="${titleBlockHeight}" fill="#fff" stroke="#111827" stroke-width="0.5"/>
  <line x1="${size.width - margin - 130}" y1="${size.height - margin - titleBlockHeight}" x2="${size.width - margin - 130}" y2="${size.height - margin}" stroke="#111827" stroke-width="0.35"/>
  <text x="${margin + 6}" y="${size.height - margin - titleBlockHeight + 12}" font-family="Arial" font-size="6" font-weight="700" fill="#111827">${escapeXml(sheet.projectName)}</text>
  <text x="${margin + 6}" y="${size.height - margin - titleBlockHeight + 23}" font-family="Arial" font-size="5" fill="#334155">${escapeXml(sheet.title)}</text>
  <text x="${size.width - margin - 122}" y="${size.height - margin - titleBlockHeight + 12}" font-family="Arial" font-size="5" fill="#111827">Format: ${sheet.format}</text>
  <text x="${size.width - margin - 122}" y="${size.height - margin - titleBlockHeight + 23}" font-family="Arial" font-size="4" fill="#334155">${sheet.createdAt.toLocaleDateString("ru-RU")}</text>
</svg>`;
}

function placeholderProjectionLines(x: number, y: number, width: number, height: number) {
  const lines: string[] = [];
  const count = 8;
  for (let index = 0; index < count; index++) {
    const px = x + (width / count) * index;
    lines.push(`<line x1="${px.toFixed(1)}" y1="${y}" x2="${(px + width / 3).toFixed(1)}" y2="${(y + height * 0.72).toFixed(1)}"/>`);
  }
  lines.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none"/>`);
  return lines.join("\n    ");
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] ?? char);
}
