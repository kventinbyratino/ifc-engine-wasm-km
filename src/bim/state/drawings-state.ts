import type { DrawingDocument } from "../drawings/drawing-document";
import type { SheetRecord } from "../sheets/sheet-types";

export type DrawingsWorkspaceState = {
  drawings: DrawingDocument[];
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

export function setActiveDrawing(drawingsState: DrawingsWorkspaceState, drawingId: string) {
  const index = drawingsState.drawings.findIndex((drawing) => drawing.id === drawingId);
  if (index <= 0) return getActiveDrawing(drawingsState);
  const [drawing] = drawingsState.drawings.splice(index, 1);
  drawingsState.drawings.unshift(drawing);
  return drawing;
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
