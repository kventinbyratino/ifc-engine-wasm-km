import type { DrawingRecord } from "../drawings/drawings-panel";
import type { SheetRecord } from "../sheets/sheet-types";

export type DrawingsWorkspaceState = {
  drawings: DrawingRecord[];
  sheets: SheetRecord[];
};

export function createDrawingsState(): DrawingsWorkspaceState {
  return {
    drawings: [],
    sheets: [],
  };
}

export function getActiveDrawing(drawingsState: DrawingsWorkspaceState) {
  return drawingsState.drawings[0] ?? null;
}

export function getActiveSheet(drawingsState: DrawingsWorkspaceState) {
  return drawingsState.sheets[0] ?? null;
}

export function getDrawingStats(drawingsState: DrawingsWorkspaceState) {
  const totalLines = drawingsState.drawings.reduce((sum, record) => sum + record.lineCount, 0);
  const totalAnnotations = drawingsState.drawings.reduce((sum, record) => sum + record.annotations.length, 0);

  return {
    drawingCount: drawingsState.drawings.length,
    sheetCount: drawingsState.sheets.length,
    totalLines,
    totalAnnotations,
  };
}
