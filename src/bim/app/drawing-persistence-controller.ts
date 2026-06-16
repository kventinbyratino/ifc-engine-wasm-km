import { attachSheetDocument, createSheetDocument } from "../drawings/drawing-document.ts";
import {
  clearStoredDrawingWorkspace,
  loadStoredDrawingWorkspace,
  saveDrawingWorkspace,
  type StoredDrawingWorkspace,
} from "../drawings/drawing-persistence.ts";
import type { DrawingRecord } from "../drawings/drawing-manager.ts";
import type { BimAppContext } from "./app-context.ts";

export function createDrawingPersistenceController(ctx: BimAppContext, getProjectName: () => string) {
  const { workspace } = ctx;
  const { components } = ctx.viewer;

  function persistDrawings() {
    if (typeof localStorage === "undefined") return null;
    try {
      return saveDrawingWorkspace(getProjectName(), workspace.drawings.drawings, workspace.drawings.sheets, components);
    } catch (error) {
      console.warn("Drawing persistence failed", error);
      return null;
    }
  }

  function getStoredDrawingWorkspace(): StoredDrawingWorkspace | null {
    try {
      return loadStoredDrawingWorkspace(getProjectName());
    } catch (error) {
      console.warn("Drawing persistence restore failed", error);
      return null;
    }
  }

  function restoreStoredSheetsForDrawing(record: DrawingRecord, stored: StoredDrawingWorkspace | null | undefined, storedDrawingId: string | undefined) {
    if (!storedDrawingId) return;
    const existingSheetIds = new Set(workspace.drawings.sheets.map((sheet) => sheet.id));
    const restoredSheets = stored?.sheets
      .filter((sheet) => sheet.drawingId === storedDrawingId && !existingSheetIds.has(sheet.id))
      .map((sheet) => {
        const restored = createSheetDocument({
          format: sheet.format,
          drawing: record,
          title: sheet.title,
          projectName: sheet.projectName,
          id: sheet.id,
          createdAt: new Date(sheet.createdAt),
          specBlocks: sheet.specBlocks.map((block) => ({
            id: block.id,
            title: block.title,
            order: block.order,
            rows: block.rows.map((row) => ({ ...row })),
          })),
        });
        attachSheetDocument(record, restored);
        return restored;
      }) ?? [];
    workspace.drawings.sheets.unshift(...restoredSheets);
  }

  return {
    persistDrawings,
    getStoredDrawingWorkspace,
    restoreStoredSheetsForDrawing,
    clearStoredDrawingWorkspace,
  };
}
