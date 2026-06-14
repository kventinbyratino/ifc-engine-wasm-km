import type { SpecificationRow } from "../specs/spec-generator";

export type SheetSize = { width: number; height: number };
export type SpecLayoutRect = { x: number; y: number; width: number; height: number };

export type SpecLayout = {
  drawingViewport: SpecLayoutRect;
  specArea: SpecLayoutRect | null;
  blocks: SpecLayoutRect[];
};

export function buildSpecLayout(options: {
  sheetSize: SheetSize;
  margin: number;
  titleBlockHeight: number;
  blockCount: number;
  gap?: number;
  minSidebarWidth?: number;
  maxSidebarRatio?: number;
}): SpecLayout {
  const gap = Math.max(0, options.gap ?? 8);
  const contentWidth = Math.max(0, options.sheetSize.width - options.margin * 2);
  const contentHeight = Math.max(0, options.sheetSize.height - options.margin * 2 - options.titleBlockHeight);
  const drawingViewport: SpecLayoutRect = { x: options.margin, y: options.margin, width: contentWidth, height: contentHeight };

  if (options.blockCount <= 0 || contentWidth <= 0 || contentHeight <= 0) {
    return { drawingViewport, specArea: null, blocks: [] };
  }

  const minSidebarWidth = options.minSidebarWidth ?? 120;
  const maxSidebarRatio = options.maxSidebarRatio ?? 0.42;
  const preferredSidebarWidth = Math.round(contentWidth * 0.34);
  const sidebarWidth = clamp(preferredSidebarWidth, minSidebarWidth, Math.max(minSidebarWidth, Math.floor(contentWidth * maxSidebarRatio)));
  const availableForDrawing = Math.max(0, contentWidth - sidebarWidth - gap);
  const specArea: SpecLayoutRect = {
    x: options.margin + contentWidth - sidebarWidth,
    y: options.margin,
    width: sidebarWidth,
    height: contentHeight,
  };

  drawingViewport.width = availableForDrawing;

  const blocks: SpecLayoutRect[] = [];
  const blockHeight = Math.max(44, Math.floor((contentHeight - gap * Math.max(0, options.blockCount - 1)) / options.blockCount));
  for (let index = 0; index < options.blockCount; index += 1) {
    const y = specArea.y + index * (blockHeight + gap);
    blocks.push({
      x: specArea.x,
      y,
      width: specArea.width,
      height: Math.min(blockHeight, Math.max(24, specArea.y + specArea.height - y)),
    });
  }

  return { drawingViewport, specArea, blocks };
}

export function formatSpecRows(rows: SpecificationRow[]) {
  return rows.map((row) => [row.category, row.storey, row.count] as const);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
