import { isEmptySelection } from "../selection/selection";
import { recordsToModelIdMap } from "../data/element-index";
import {
  createTechnicalDrawing,
  disposeDrawing,
  downloadDrawingDxf,
  fitCameraToDrawing,
  renderDrawingList,
  type DrawingRecord,
  type DrawingSource,
  type DrawingView,
} from "../drawings/drawings-panel";
import {
  addDrawingAnnotation,
  clearDrawingAnnotations,
  getDrawingAnnotationTypeLabel,
  syncDrawingAnnotations,
  type DrawingAnnotationType,
} from "../drawings/drawing-annotations";
import {
  clearStoredDrawingWorkspace,
  loadStoredDrawingWorkspace,
  replayStoredAnnotations,
  saveDrawingWorkspace,
  type StoredDrawingWorkspace,
} from "../drawings/drawing-persistence";
import { createSheet } from "../sheets/sheet-board";
import { downloadSheetPng, downloadSheetSvg, openSheetPdfPrint } from "../sheets/pdf-export";
import { downloadSheetDxfPaperSpace } from "../sheets/dxf-paper-export";
import type { SheetFormat } from "../sheets/sheet-types";
import { generateSpecification, specificationToCsv } from "../specs/spec-generator";
import type { ModelIdMap } from "../types";
import type { BimAppContext } from "./app-context";

export interface DrawingsControllerHooks {
  canUseDrawings: () => boolean;
  getGeometryItemsMap: () => Promise<ModelIdMap>;
  downloadTextFile: (name: string, content: string, type: string) => void;
}

export function createDrawingsController(ctx: BimAppContext, hooks: DrawingsControllerHooks) {
  const { workspace } = ctx;
  const { components, world, fragments } = ctx.viewer;
  const {
    fileName,
    drawingsPanel,
    drawingsSummary,
    drawingSourceSelect,
    drawingViewSelect,
    drawingFarInput,
    sheetFormatSelect,
    annotationTypeSelect,
    annotationTextInput,
    addAnnotationBtn,
    generateDrawingBtn,
    exportSheetPngBtn,
    drawingsOutput,
  } = ctx.dom;

  function toggleDrawingsPanel() {
    if (drawingsPanel.hidden) {
      openDrawingsPanel();
      return;
    }
    closeDrawingsPanel();
  }

  function openDrawingsPanel() {
    if (!hooks.canUseDrawings()) {
      drawingsPanel.hidden = true;
      ctx.setStatus("Drawings / DXF доступны только в профиле BIM");
      return;
    }

    drawingsPanel.hidden = false;
    renderDrawingsPanel();
  }

  function closeDrawingsPanel() {
    drawingsPanel.hidden = true;
  }

  async function generateDrawing() {
    if (!hooks.canUseDrawings()) return;
    if (fragments.list.size === 0) return;

    generateDrawingBtn.loading = true;
    try {
      const source = drawingSourceSelect.value as DrawingSource;
      const view = drawingViewSelect.value as DrawingView;
      const modelIdMap = await getDrawingSourceMap(source);
      const far = Number(drawingFarInput.value) || 40;
      drawingsSummary.textContent = "Генерация проекции...";

      const record = await createTechnicalDrawing({
        components,
        world,
        fragments,
        modelIdMap,
        view,
        source,
        far,
        onProgress: (message, progressValue) => {
          const progressText = typeof progressValue === "number" ? ` · ${Math.round(progressValue * 100)}%` : "";
          drawingsSummary.textContent = `${message}${progressText}`;
        },
      });

      const stored = getStoredDrawingWorkspace();
      const storedDrawing = stored?.drawings.find((item) => item.view === view && item.source === source);
      if (storedDrawing?.annotations.length) {
        replayStoredAnnotations(record, storedDrawing.annotations, components);
        syncDrawingAnnotations(components, record);
      }

      workspace.drawings.unshift(record);
      persistDrawings();
      renderDrawingsPanel();
      await fitCameraToDrawing(world, record);
      ctx.setStatus(`Чертёж готов: ${record.lineCount} линий`);
      ctx.showToast(`Чертёж готов: ${record.lineCount} линий`, "success");
    } catch (error) {
      console.error(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      generateDrawingBtn.loading = false;
    }
  }

  async function getDrawingSourceMap(source: DrawingSource) {
    if (source === "selection") {
      if (isEmptySelection(workspace.activeSelection)) throw new Error("Нет текущей выборки");
      return workspace.activeSelection;
    }

    if (source === "filtered") {
      if (workspace.filteredElements.length === 0) throw new Error("Нет элементов в фильтре Data Browser");
      return recordsToModelIdMap(workspace.filteredElements);
    }

    return hooks.getGeometryItemsMap();
  }

  function renderDrawingsPanel() {
    const totalLines = workspace.drawings.reduce((sum, record) => sum + record.lineCount, 0);
    const totalAnnotations = workspace.drawings.reduce((sum, record) => sum + record.annotations.length, 0);
    drawingsSummary.textContent = workspace.drawings.length
      ? `${workspace.drawings.length} черт. · ${workspace.sheets.length} лист. · ${totalLines} линий · ${totalAnnotations} анн.`
      : fragments.list.size > 0
        ? "Можно генерировать план/фасады"
        : "Загрузите модель";

    renderDrawingList({
      records: workspace.drawings,
      output: drawingsOutput,
      onSelect: (record) => void fitCameraToDrawing(world, record),
      onExport: downloadDrawingDxf,
      onAnnotate: (record) => void annotateDrawing(record),
      onDelete: (record) => {
        disposeDrawing(record);
        workspace.drawings = workspace.drawings.filter((item) => item.id !== record.id);
        workspace.sheets = workspace.sheets.filter((sheet) => sheet.drawing.id !== record.id);
        persistDrawings();
        renderDrawingsPanel();
      },
    });
  }

  async function annotateActiveDrawing() {
    const record = workspace.drawings[0];
    if (!record) {
      drawingsSummary.textContent = "Сначала сгенерируйте чертёж";
      return;
    }
    await annotateDrawing(record);
  }

  async function annotateDrawing(record: DrawingRecord) {
    addAnnotationBtn.loading = true;
    try {
      const type = annotationTypeSelect.value as DrawingAnnotationType;
      const annotation = addDrawingAnnotation(record, {
        components,
        type,
        text: annotationTextInput.value,
      });
      annotationTextInput.value = "";
      syncDrawingAnnotations(components, record);
      persistDrawings();
      renderDrawingsPanel();
      await fitCameraToDrawing(world, record);
      drawingsSummary.textContent = `${getDrawingAnnotationTypeLabel(annotation.type)} добавлена · всего ${record.annotations.length}`;
      ctx.setStatus(`Аннотация добавлена: ${annotation.text}`);
      ctx.showToast(`${getDrawingAnnotationTypeLabel(annotation.type)} добавлена`, "success");
    } catch (error) {
      console.error(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      addAnnotationBtn.loading = false;
    }
  }

  function clearActiveDrawingAnnotations() {
    const record = workspace.drawings[0];
    if (!record) {
      drawingsSummary.textContent = "Сначала сгенерируйте чертёж";
      return;
    }
    clearDrawingAnnotations(record, components);
    persistDrawings();
    renderDrawingsPanel();
    drawingsSummary.textContent = `Аннотации очищены: ${record.name}`;
    ctx.showToast("Аннотации очищены", "success");
  }

  function createSheetFromActiveDrawing() {
    const record = workspace.drawings[0];
    if (!record) {
      drawingsSummary.textContent = "Сначала сгенерируйте чертёж";
      return;
    }
    const sheet = createSheet({
      format: sheetFormatSelect.value as SheetFormat,
      drawing: record,
      title: record.name,
      projectName: getProjectName(),
    });
    workspace.sheets.unshift(sheet);
    persistDrawings();
    renderDrawingsPanel();
    drawingsSummary.textContent = `Лист создан: ${sheet.format} · ${sheet.title}`;
    ctx.showToast(`Лист создан: ${sheet.format}`, "success");
  }

  function getActiveSheet() {
    if (!workspace.sheets[0]) createSheetFromActiveDrawing();
    return workspace.sheets[0] ?? null;
  }

  function getProjectName() {
    return fileName.textContent && fileName.textContent !== "-" ? fileName.textContent : "BIM Manager Workbench";
  }

  function persistDrawings() {
    if (typeof localStorage === "undefined") return null;
    try {
      return saveDrawingWorkspace(getProjectName(), workspace.drawings, workspace.sheets, components);
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
      console.error(error);
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
      console.error(error);
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
      console.error(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    }
  }

  function exportSpecifications() {
    const source = workspace.filteredElements.length > 0 ? workspace.filteredElements : workspace.elementIndex;
    if (source.length === 0) {
      drawingsSummary.textContent = "Нет элементов для спецификации";
      return;
    }
    const rows = generateSpecification(source);
    hooks.downloadTextFile("bim-specification.csv", specificationToCsv(rows), "text/csv;charset=utf-8");
    drawingsSummary.textContent = `Спецификация экспортирована: ${rows.length} строк`;
    ctx.showToast(`Спецификация экспортирована: ${rows.length} строк`, "success");
  }

  function clearDrawings() {
    for (const record of workspace.drawings) disposeDrawing(record);
    workspace.drawings = [];
    workspace.sheets = [];
    clearStoredDrawingWorkspace();
    renderDrawingsPanel();
  }

  return {
    toggleDrawingsPanel,
    openDrawingsPanel,
    closeDrawingsPanel,
    generateDrawing,
    renderDrawingsPanel,
    annotateActiveDrawing,
    annotateDrawing,
    clearActiveDrawingAnnotations,
    createSheetFromActiveDrawing,
    exportActiveSheetSvg,
    exportActiveSheetPng,
    exportActiveSheetPdf,
    exportActiveSheetDxf,
    exportSpecifications,
    clearDrawings,
    persistDrawings,
  };
}
