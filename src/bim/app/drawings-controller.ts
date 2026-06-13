import { countSelection, isEmptySelection } from "../selection/selection";
import { recordsToModelIdMap } from "../data/element-index";
import {
  createTechnicalDrawing,
  disposeDrawing,
  downloadDrawingDxf,
  fitCameraToDrawing,
  renderDrawingList,
  type DrawingRecord,
} from "../drawings/drawings-panel";
import {
  addDrawingAnnotation,
  clearDrawingAnnotations,
  deleteDrawingAnnotation,
  getDrawingAnnotationTypeLabel,
  syncDrawingAnnotations,
  updateDrawingAnnotationText,
  type DrawingAnnotation,
  type DrawingAnnotationType,
} from "../drawings/drawing-annotations";
import {
  clearStoredDrawingWorkspace,
  loadStoredDrawingWorkspace,
  replayStoredAnnotations,
  saveDrawingWorkspace,
  type StoredDrawingWorkspace,
} from "../drawings/drawing-persistence";
import { attachSheetDocument, createSheetDocument, removeSheetDocumentsForDrawing } from "../drawings/drawing-document";
import { createSheet, renderSheetSvg } from "../sheets/sheet-board";
import { downloadSheetPng, downloadSheetSvg, openSheetPdfPrint } from "../sheets/pdf-export";
import { downloadSheetDxfPaperSpace } from "../sheets/dxf-paper-export";
import type { SheetFormat, SheetRecord } from "../sheets/sheet-types";
import { generateSpecification, specificationToCsv } from "../specs/spec-generator";
import { getActiveDrawing, getActiveSheet, getDrawingStats, setActiveDrawing } from "../state/workspace-state";
import type { ModelIdMap } from "../types";
import type { BimAppContext } from "./app-context";
import type { DrawingSource, DrawingView } from "../drawings/drawing-types";
import { cloneModelIdMap, findBestMatchingDrawing } from "../drawings/drawing-selection-sync";

export interface DrawingsControllerHooks {
  canUseDrawings: () => boolean;
  getGeometryItemsMap: () => Promise<ModelIdMap>;
  downloadTextFile: (name: string, content: string, type: string) => void;
  applySearchHighlight: (modelIdMap: ModelIdMap) => Promise<void>;
  fitToItems: (modelIdMap: ModelIdMap) => Promise<void>;
  setModelSelection: (modelIdMap: ModelIdMap) => Promise<void>;
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
    drawingStudioBtn,
    drawingPreview,
    exportSheetPngBtn,
    drawingsOutput,
    viewerShell,
    drawingSplitHandle,
  } = ctx.dom;

  let drawingStudioActive = false;
  let drawingSplitRatio = 0.58;
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
    if (!isEmptySelection(workspace.viewer.activeSelection)) syncDrawingSelectionFromModel(workspace.viewer.activeSelection);
  }

  function closeDrawingsPanel() {
    drawingsPanel.hidden = true;
    setDrawingStudioActive(false);
  }

  function toggleDrawingStudio() {
    if (drawingsPanel.hidden) {
      openDrawingsPanel();
      if (drawingsPanel.hidden) return;
    }
    setDrawingStudioActive(!drawingStudioActive);
  }

  function setDrawingStudioActive(value: boolean) {
    drawingStudioActive = value;
    viewerShell.classList.toggle("is-drawing-split", value);
    drawingSplitHandle.hidden = !value;
    drawingStudioBtn.classList.toggle("is-active", value);
    drawingStudioBtn.textContent = value ? "Закрыть оформление" : "Оформление";
    if (value) {
      updateDrawingSplitRatio(drawingSplitRatio);
      renderDrawingPreview();
    } else {
      viewerShell.style.removeProperty("--drawing-split-left");
      viewerShell.style.removeProperty("--drawing-split-right");
    }
  }

  function updateDrawingSplitRatio(nextRatio: number) {
    drawingSplitRatio = clamp(nextRatio, 0.42, 0.72);
    viewerShell.style.setProperty("--drawing-split-left", `${(drawingSplitRatio * 100).toFixed(1)}%`);
    viewerShell.style.setProperty("--drawing-split-right", `${((1 - drawingSplitRatio) * 100).toFixed(1)}%`);
  }

  function handleDrawingSplitDrag(event: PointerEvent) {
    if (!drawingStudioActive || event.button !== 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const updateFromEvent = (moveEvent: PointerEvent) => {
      const rect = viewerShell.getBoundingClientRect();
      if (rect.width <= 0) return;
      const nextRatio = (moveEvent.clientX - rect.left) / rect.width;
      updateDrawingSplitRatio(nextRatio);
      renderDrawingPreview();
    };
    const onPointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      updateFromEvent(moveEvent);
    };
    const onPointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      try {
        drawingSplitHandle.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
    };

    drawingSplitHandle.setPointerCapture(pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    updateFromEvent(event);
  }

  function renderDrawingPreview() {
    const record = getActiveDrawing(workspace.drawings);
    if (!record) {
      drawingPreview.replaceChildren(createPreviewMessage("Откройте режим оформления или выберите чертёж."));
      return;
    }

    const activeSheet = workspace.drawings.sheets.find((sheet) => sheet.drawing.id === record.id) ?? null;
    const previewSheet: SheetRecord = activeSheet ?? {
      id: `preview-${record.id}`,
      format: sheetFormatSelect.value as SheetFormat,
      title: `Оформление: ${record.name}`,
      projectName: getProjectName(),
      drawing: record,
      createdAt: record.createdAt,
    };

    drawingPreview.replaceChildren(createPreviewFrame(previewSheet));
  }

  function createPreviewFrame(sheet: SheetRecord) {
    const frame = document.createElement("div");
    frame.className = "drawing-preview-frame";
    frame.innerHTML = renderSheetSvg(sheet);
    return frame;
  }

  function createPreviewMessage(message: string) {
    const wrapper = document.createElement("div");
    wrapper.className = "empty-state";
    wrapper.textContent = message;
    return wrapper;
  }

  async function activateDrawing(record: DrawingRecord, syncSelection: boolean) {
    setActiveDrawing(workspace.drawings, record.id);
    setDrawingStudioActive(true);
    renderDrawingsPanel();
    await fitCameraToDrawing(world, record);
    if (syncSelection) {
      await syncModelSelectionFromDrawing(record);
    } else {
      renderDrawingPreview();
    }
  }

  async function syncModelSelectionFromDrawing(record: DrawingRecord) {
    const sourceSelection = cloneModelIdMap(record.sourceModelIdMap);
    if (isEmptySelection(sourceSelection)) {
      drawingsSummary.textContent = `У чертежа нет исходной выборки: ${record.name}`;
      return;
    }

    await hooks.applySearchHighlight(sourceSelection);
    await hooks.fitToItems(sourceSelection);
    await hooks.setModelSelection(sourceSelection);
    drawingsSummary.textContent = `Выборка связана с чертежом: ${countSelection(sourceSelection)} элементов`;
    ctx.setStatus(`Выборка связана с чертежом: ${record.name}`);
    renderDrawingPreview();
  }

  function syncDrawingSelectionFromModel(modelIdMap: ModelIdMap) {
    if (isEmptySelection(modelIdMap) || workspace.drawings.drawings.length === 0) return;

    const best = findBestMatchingDrawing(workspace.drawings.drawings, modelIdMap);
    if (!best) return;

    if (workspace.drawings.drawings[0]?.id !== best.drawing.id) {
      setActiveDrawing(workspace.drawings, best.drawing.id);
    }
    if (drawingStudioActive) renderDrawingPreview();
    renderDrawingsPanel();
    ctx.setStatus(`Активен чертёж: ${best.drawing.name} · совпадение ${best.overlap} эл.`);
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  drawingStudioBtn.addEventListener("click", toggleDrawingStudio);
  drawingSplitHandle.addEventListener("pointerdown", handleDrawingSplitDrag);

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

      workspace.drawings.drawings.unshift(record);
      restoreStoredSheetsForDrawing(record, stored, storedDrawing?.id);
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
      if (isEmptySelection(workspace.viewer.activeSelection)) throw new Error("Нет текущей выборки");
      return workspace.viewer.activeSelection;
    }

    if (source === "filtered") {
      if (workspace.data.filteredElements.length === 0) throw new Error("Нет элементов в фильтре Data Browser");
      return recordsToModelIdMap(workspace.data.filteredElements);
    }

    return hooks.getGeometryItemsMap();
  }

  function renderDrawingsPanel() {
    const stats = getDrawingStats(workspace.drawings);
    drawingsSummary.textContent = stats.drawingCount
      ? `${stats.drawingCount} черт. · ${stats.sheetCount} лист. · ${stats.totalLines} линий · ${stats.totalAnnotations} анн.`
      : fragments.list.size > 0
        ? "Можно генерировать план/фасады"
        : "Загрузите модель";

    renderDrawingList({
      records: workspace.drawings.drawings,
      output: drawingsOutput,
      activeDrawingId: getActiveDrawing(workspace.drawings)?.id ?? null,
      onSelect: (record) => {
        void activateDrawing(record, true);
      },
      onExport: downloadDrawingDxf,
      onAnnotate: (record) => void annotateDrawing(record),
      onEditAnnotation: editAnnotationText,
      onDeleteAnnotation: deleteAnnotation,
      onDelete: (record) => {
        disposeDrawing(record);
        workspace.drawings.drawings = workspace.drawings.drawings.filter((item) => item.id !== record.id);
        workspace.drawings.sheets = workspace.drawings.sheets.filter((sheet) => sheet.drawing.id !== record.id);
        removeSheetDocumentsForDrawing(record);
        persistDrawings();
        renderDrawingsPanel();
      },
    });
    renderDrawingPreview();
  }

  function editAnnotationText(record: DrawingRecord, annotation: DrawingAnnotation) {
    const nextText = window.prompt("Текст аннотации", annotation.text);
    if (nextText === null) return;
    try {
      updateDrawingAnnotationText(record, components, annotation.id, nextText);
      persistDrawings();
      renderDrawingsPanel();
      drawingsSummary.textContent = "Аннотация обновлена";
      ctx.showToast("Аннотация обновлена", "success");
    } catch (error) {
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    }
  }

  function deleteAnnotation(record: DrawingRecord, annotation: DrawingAnnotation) {
    try {
      deleteDrawingAnnotation(record, components, annotation.id);
      persistDrawings();
      renderDrawingsPanel();
      drawingsSummary.textContent = "Аннотация удалена";
      ctx.showToast("Аннотация удалена", "success");
    } catch (error) {
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    }
  }

  async function annotateActiveDrawing() {
    const record = getActiveDrawing(workspace.drawings);
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
    const record = getActiveDrawing(workspace.drawings);
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
    const record = getActiveDrawing(workspace.drawings);
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
    workspace.drawings.sheets.unshift(sheet);
    attachSheetDocument(record, sheet);
    persistDrawings();
    renderDrawingsPanel();
    drawingsSummary.textContent = `Лист создан: ${sheet.format} · ${sheet.title}`;
    ctx.showToast(`Лист создан: ${sheet.format}`, "success");
  }

  function getActiveSheet() {
    if (!workspace.drawings.sheets[0]) createSheetFromActiveDrawing();
    return workspace.drawings.sheets[0] ?? null;
  }

  function getProjectName() {
    return fileName.textContent && fileName.textContent !== "-" ? fileName.textContent : "BIM Manager Workbench";
  }

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
        });
        attachSheetDocument(record, restored);
        return restored;
      }) ?? [];
    workspace.drawings.sheets.unshift(...restoredSheets);
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

  function clearDrawings() {
    for (const record of workspace.drawings.drawings) {
      disposeDrawing(record);
      removeSheetDocumentsForDrawing(record);
    }
    workspace.drawings.drawings = [];
    workspace.drawings.sheets = [];
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
    syncDrawingSelectionFromModel,
    clearDrawings,
    persistDrawings,
  };
}
