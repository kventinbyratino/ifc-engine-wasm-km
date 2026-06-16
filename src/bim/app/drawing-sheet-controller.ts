import { attachSheetDocument } from "../drawings/drawing-document.ts";
import { createSheet } from "../sheets/sheet-board.ts";
import { downloadSheetPng, downloadSheetSvg, openSheetPdfPrint } from "../sheets/pdf-export.ts";
import { downloadSheetDxfPaperSpace } from "../sheets/dxf-paper-export.ts";
import { generateSpecification, specificationToCsv } from "../specs/spec-generator.ts";
import { createSpecBlocksFromRows } from "../sheets/spec-placement.ts";
import { getActiveDrawing } from "../state/workspace-state.ts";
import type { SheetFormat } from "../sheets/sheet-types.ts";
import type { BimAppContext } from "./app-context.ts";
import { logControllerError } from "../ui/controller-errors.ts";

export interface DrawingSheetControllerHooks {
  downloadTextFile: (name: string, content: string, type: string) => void;
  persistDrawings: () => unknown;
  renderDrawingsPanel: () => void;
  getProjectName: () => string;
}

export function createDrawingSheetController(ctx: BimAppContext, hooks: DrawingSheetControllerHooks) {
  const { workspace } = ctx;
  const { components } = ctx.viewer;
  const { dom } = ctx;
  const {
    drawingsSummary,
    sheetFormatSelect,
    exportSheetPngBtn,
  } = dom;

  function createSheetFromActiveDrawing() {
    const record = getActiveDrawing(workspace.drawings);
    if (!record) {
      drawingsSummary.textContent = "Сначала сгенерируйте чертёж";
      return;
    }
    const sheet = createSheet({
      format: sheetFormatSelect.value as SheetFormat,
      drawing: record,
      title: record.name,
      projectName: hooks.getProjectName(),
    });
    workspace.drawings.sheets.unshift(sheet);
    attachSheetDocument(record, sheet);
    hooks.persistDrawings();
    hooks.renderDrawingsPanel();
    drawingsSummary.textContent = `Лист создан: ${sheet.format} · ${sheet.title}`;
    ctx.showToast(`Лист создан: ${sheet.format}`, "success");
  }

  function getActiveSheet() {
    if (!workspace.drawings.sheets[0]) createSheetFromActiveDrawing();
    return workspace.drawings.sheets[0] ?? null;
  }

  function exportActiveSheetSvg() {
    const sheet = getActiveSheet();
    if (!sheet) return;
    downloadSheetSvg(sheet);
    drawingsSummary.textContent = `SVG экспортирован: ${sheet.format}`;
    ctx.showToast(`SVG экспортирован: ${sheet.format}`, "success");
  }

  async function exportActiveSheetPng() {
    const sheet = getActiveSheet();
    if (!sheet) return;
    exportSheetPngBtn.loading = true;
    try {
      await downloadSheetPng(sheet);
      drawingsSummary.textContent = `PNG экспортирован: ${sheet.format}`;
      ctx.showToast(`PNG экспортирован: ${sheet.format}`, "success");
    } catch (error) {
      logControllerError(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      exportSheetPngBtn.loading = false;
    }
  }

  function exportActiveSheetPdf() {
    const sheet = getActiveSheet();
    if (!sheet) return;
    try {
      openSheetPdfPrint(sheet);
      drawingsSummary.textContent = `PDF/print открыт: ${sheet.format}`;
      ctx.showToast(`PDF/print открыт: ${sheet.format}`, "success");
    } catch (error) {
      logControllerError(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    }
  }

  function exportActiveSheetDxf() {
    const sheet = getActiveSheet();
    if (!sheet) return;
    try {
      downloadSheetDxfPaperSpace(components, sheet);
      drawingsSummary.textContent = `DXF paper-space экспортирован: ${sheet.format}`;
      ctx.showToast(`DXF экспортирован: ${sheet.format}`, "success");
    } catch (error) {
      logControllerError(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    }
  }

  function placeSpecificationsOnActiveSheet() {
    const sheet = getActiveSheet();
    if (!sheet) {
      drawingsSummary.textContent = "Сначала сгенерируйте лист";
      return;
    }
    const source = workspace.data.filteredElements.length > 0 ? workspace.data.filteredElements : workspace.data.elementIndex;
    if (source.length === 0) {
      drawingsSummary.textContent = "Нет элементов для спецификации";
      return;
    }
    const rows = generateSpecification(source);
    const blocks = createSpecBlocksFromRows(rows, {
      title: `${sheet.title} · Спецификация`,
      maxRowsPerBlock: 10,
      idPrefix: `${sheet.id}-spec`,
    });
    if (blocks.length === 0) {
      drawingsSummary.textContent = "Нет строк для спецификации";
      return;
    }
    sheet.specBlocks = blocks;
    hooks.persistDrawings();
    hooks.renderDrawingsPanel();
    drawingsSummary.textContent = `Спецификация размещена на листе: ${blocks.length} блоков`;
    ctx.showToast(`Спецификация размещена: ${blocks.length} блоков`, "success");
  }

  function exportSpecifications() {
    const source = workspace.data.filteredElements.length > 0 ? workspace.data.filteredElements : workspace.data.elementIndex;
    if (source.length === 0) {
      drawingsSummary.textContent = "Нет элементов для спецификации";
      return;
    }
    const rows = generateSpecification(source);
    hooks.downloadTextFile("bim-specification.csv", specificationToCsv(rows), "text/csv;charset=utf-8");
    drawingsSummary.textContent = `Спецификация экспортирована: ${rows.length} строк`;
    ctx.showToast(`Спецификация экспортирована: ${rows.length} строк`, "success");
  }

  return {
    createSheetFromActiveDrawing,
    exportActiveSheetSvg,
    exportActiveSheetPng,
    exportActiveSheetPdf,
    exportActiveSheetDxf,
    placeSpecificationsOnActiveSheet,
    exportSpecifications,
  };
}
