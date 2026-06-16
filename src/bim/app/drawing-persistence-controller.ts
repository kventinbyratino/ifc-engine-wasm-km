import { attachSheetDocument, createSheetDocument, type DrawingDocument, type SheetDocument } from "../drawings/drawing-document.ts";
import { clearStoredDrawingWorkspace, loadStoredDrawingWorkspace, saveDrawingWorkspace, type StoredDrawingWorkspace } from "../drawings/drawing-persistence.ts";
import type { BimAppContext } from "./app-context.ts";

export interface DrawingPersistenceControllerHooks {
  getProjectName: () => string;
}

export function createDrawingPersistenceController(ctx: BimAppContext, getProjectName: () => string) {
  const { workspace } = ctx;
  const { components } = ctx.viewer;

  function persistDrawings() {
    return saveDrawingWorkspace(getProjectName(), workspace.drawings.drawings, workspace.drawings.sheets, components);
  }

  function getStoredDrawingWorkspace() {
    return loadStoredDrawingWorkspace(getProjectName());
  }

  function restoreStoredSheetsForDrawing(record: DrawingDocument, stored: StoredDrawingWorkspace | null, storedDrawingId?: string) {
    if (!stored) return [] as SheetDocument[];

    const matchingSheets = stored.sheets.filter((sheet) => sheet.drawingId === (storedDrawingId ?? record.id));
    const restoredSheets: SheetDocument[] = [];

    for (const sheet of matchingSheets) {
      if (workspace.drawings.sheets.some((item) => item.id === sheet.id)) continue;
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
        viewportFrame: { ...sheet.viewportFrame },
      });
      workspace.drawings.sheets.unshift(restored);
      attachSheetDocument(record, restored);
      restoredSheets.push(restored);
    }

    return restoredSheets;
  }

  function clearStoredWorkspace() {
    clearStoredDrawingWorkspace();
  }

  return {
    persistDrawings,
    getStoredDrawingWorkspace,
    restoreStoredSheetsForDrawing,
    clearStoredDrawingWorkspace: clearStoredWorkspace,
  };
}
