import { countSelection, isEmptySelection } from "../selection/selection.ts";
import { recordsToModelIdMap } from "../data/element-index.ts";
import {
  createTechnicalDrawing,
  createFloorPlanDrawing,
  disposeDrawing,
  fitCameraToDrawing,
  type DrawingRecord,
} from "../drawings/drawing-manager.ts";
import { downloadDrawingDxf } from "../drawings/dxf-export.ts";
import { renderDrawingList } from "../ui/drawings-panel.ts";
import {
  addDrawingAnnotation,
  clearDrawingAnnotations,
  deleteDrawingAnnotation,
  getDrawingAnnotationTypeLabel,
  syncDrawingAnnotations,
  updateDrawingAnnotationText,
  type DrawingAnnotation,
  type DrawingAnnotationType,
} from "../drawings/drawing-annotations.ts";
import {
  replayStoredAnnotations,
} from "../drawings/drawing-persistence.ts";
import { removeSheetDocumentsForDrawing } from "../drawings/drawing-document.ts";
import { renderSheetSvg } from "../sheets/sheet-board.ts";
import { SHEET_SIZES_MM } from "../sheets/sheet-types.ts";
import type { SheetFormat, SheetRecord } from "../sheets/sheet-types.ts";
import { applySheetViewportDrag, normalizeSheetViewportFrame, type SheetViewportFrame, type SheetViewportHandle } from "../sheets/sheet-viewport-frame.ts";
import { getActiveDrawing, getActiveSheet, getDrawingStats, setActiveDrawing } from "../state/workspace-state.ts";
import type { ModelIdMap } from "../types.ts";
import type { BimAppContext } from "./app-context.ts";
import type { DrawingSource, DrawingView } from "../drawings/drawing-types.ts";
import { cloneModelIdMap, findBestMatchingDrawing, getLinkedProjectionSelection, getProjectionSelectionStatus } from "../drawings/drawing-selection-sync.ts";
import { createDrawingPersistenceController } from "./drawing-persistence-controller.ts";
import { createDrawingSheetController } from "./drawing-sheet-controller.ts";
import { logControllerError } from "../ui/controller-errors.ts";

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
      if (!getActiveSheet(workspace.drawings)) {
        createSheetFromActiveDrawing();
      }
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

    let activeSheet = workspace.drawings.sheets.find((sheet) => sheet.drawing.id === record.id) ?? null;
    if (!activeSheet && drawingStudioActive) {
      createSheetFromActiveDrawing();
      activeSheet = workspace.drawings.sheets.find((sheet) => sheet.drawing.id === record.id) ?? null;
    }

    const previewSheet: SheetRecord = activeSheet ?? {
      id: `preview-${record.id}`,
      format: sheetFormatSelect.value as SheetFormat,
      title: `Оформление: ${record.name}`,
      projectName: getProjectName(),
      drawing: record,
      createdAt: record.createdAt,
      specBlocks: [],
      viewportFrame: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    };

    drawingPreview.replaceChildren(createPreviewFrame(previewSheet));
  }

  function createPreviewFrame(sheet: SheetRecord) {
    const frame = document.createElement("div");
    frame.className = "drawing-preview-frame";
    frame.dataset.sheetId = sheet.id;
    frame.innerHTML = renderSheetSvg(sheet, { includeViewportHandles: drawingStudioActive });
    bindProjectionPickInteractions(frame, sheet.drawing);
    if (drawingStudioActive) bindViewportFrameInteractions(frame, sheet);
    return frame;
  }

  function bindProjectionPickInteractions(frame: HTMLDivElement, record: DrawingRecord) {
    const svg = frame.querySelector("svg");
    if (!(svg instanceof SVGElement)) return;

    svg.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-drawing-projection-ref-id]") : null;
      if (!(target instanceof Element)) return;
      const refId = target.getAttribute("data-drawing-projection-ref-id");
      const ref = record.projection.sourceRefs.find((item) => item.id === refId);
      if (!ref) return;
      const selection = getLinkedProjectionSelection(ref);
      if (!selection) {
        record.highlightedProjectionRefIds = [];
        record.selectionStatus = "Проекция не связана с BIM-объектом";
        drawingsSummary.textContent = record.selectionStatus;
        renderDrawingPreview();
        return;
      }
      void hooks.applySearchHighlight(selection)
        .then(() => hooks.fitToItems(selection))
        .then(() => hooks.setModelSelection(selection))
        .then(() => {
          record.highlightedProjectionRefIds = [ref.id];
          record.selectionStatus = "Проекция связана с BIM-объектом";
          drawingsSummary.textContent = `Выбрана проекция: ${ref.source?.modelId}:${ref.source?.localId}`;
          ctx.setStatus(`Чертёж → модель: ${record.name}`);
          renderDrawingPreview();
        })
        .catch((error) => {
          logControllerError(error);
          drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
        });
    });
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

    for (const drawing of workspace.drawings.drawings) {
      const match = getProjectionSelectionStatus(drawing.projection.sourceRefs, modelIdMap);
      drawing.highlightedProjectionRefIds = match.refs.map((ref) => ref.id);
      drawing.selectionStatus = match.status;
    }

    const best = findBestMatchingDrawing(workspace.drawings.drawings, modelIdMap);
    if (!best) {
      drawingsSummary.textContent = "Для выбранного BIM-объекта нет проекции на текущих чертежах";
      if (drawingStudioActive) renderDrawingPreview();
      return;
    }

    if (workspace.drawings.drawings[0]?.id !== best.drawing.id) {
      setActiveDrawing(workspace.drawings, best.drawing.id);
    }
    if (drawingStudioActive) renderDrawingPreview();
    renderDrawingsPanel();
    const statusText = best.status === "linked" ? "проекция подсвечена" : "объект вне текущего вида";
    drawingsSummary.textContent = `${statusText}: ${best.drawing.name}`;
    ctx.setStatus(`Активен чертёж: ${best.drawing.name} · совпадение ${best.overlap} эл.`);
  }

  function bindViewportFrameInteractions(frame: HTMLDivElement, sheet: SheetRecord) {
    const svg = frame.querySelector("svg");
    if (!(svg instanceof SVGElement)) return;

    const size = SHEET_SIZES_MM[sheet.format];
    let dragState: {
      handle: SheetViewportHandle;
      startFrame: SheetViewportFrame;
      startX: number;
      startY: number;
      bounds: SheetViewportFrame;
    } | null = null;

    const pointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest("[data-sheet-viewport-handle]") : null;
      if (!(target instanceof Element)) return;
      const handle = target.getAttribute("data-sheet-viewport-handle") as SheetViewportHandle | null;
      if (!handle) return;
      event.preventDefault();
      const frameBounds = getEditableViewportBounds(sheet);
      dragState = {
        handle,
        startFrame: normalizeSheetViewportFrame(sheet.viewportFrame, frameBounds, 24),
        startX: event.clientX,
        startY: event.clientY,
        bounds: frameBounds,
      };
      (target as HTMLElement).setPointerCapture(event.pointerId);
      window.addEventListener("pointermove", pointerMove);
      window.addEventListener("pointerup", pointerUp);
    };

    const pointerMove = (event: PointerEvent) => {
      if (!dragState) return;
      const svgRect = svg.getBoundingClientRect();
      if (svgRect.width <= 0 || svgRect.height <= 0) return;
      const dx = ((event.clientX - dragState.startX) / svgRect.width) * size.width;
      const dy = ((event.clientY - dragState.startY) / svgRect.height) * size.height;
      const nextFrame = applySheetViewportDrag({
        frame: dragState.startFrame,
        bounds: dragState.bounds,
        handle: dragState.handle,
        deltaX: dx,
        deltaY: dy,
        minSize: 24,
      });
      sheet.viewportFrame = nextFrame;
      persistDrawings();
      drawingPreview.replaceChildren(createPreviewFrame(sheet));
    };

    const pointerUp = () => {
      dragState = null;
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
    };

    svg.addEventListener("pointerdown", pointerDown);
  }

  function getEditableViewportBounds(sheet: SheetRecord): SheetViewportFrame {
    const size = SHEET_SIZES_MM[sheet.format];
    const margin = Math.max(12, Math.round(size.width * 0.035));
    const titleBlockHeight = Math.max(34, Math.round(size.height * 0.15));
    const specWidth = sheet.specBlocks.length > 0 ? Math.max(120, Math.round((size.width - margin * 2) * 0.34)) : 0;
    return {
      x: margin,
      y: margin,
      width: Math.max(0, size.width - margin * 2 - (specWidth > 0 ? specWidth + 8 : 0)),
      height: Math.max(0, size.height - margin * 2 - titleBlockHeight),
    };
  }

  function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  drawingStudioBtn.addEventListener("click", toggleDrawingStudio);
  drawingSplitHandle.addEventListener("pointerdown", handleDrawingSplitDrag);

  const {
    persistDrawings,
    getStoredDrawingWorkspace,
    restoreStoredSheetsForDrawing,
    clearStoredDrawingWorkspace,
  } = createDrawingPersistenceController(ctx, getProjectName);
  const sheetController = createDrawingSheetController(ctx, {
    downloadTextFile: hooks.downloadTextFile,
    persistDrawings,
    renderDrawingsPanel,
    getProjectName,
  });
  const {
    createSheetFromActiveDrawing,
    exportActiveSheetSvg,
    exportActiveSheetPng,
    exportActiveSheetPdf,
    exportActiveSheetDxf,
    placeSpecificationsOnActiveSheet,
    exportSpecifications,
  } = sheetController;

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

      const record = await (view === "plan"
        ? createFloorPlanDrawing({
            components,
            world,
            fragments,
            modelIdMap,
            source,
            far,
            onProgress: (message, progressValue) => {
              const progressText = typeof progressValue === "number" ? ` · ${Math.round(progressValue * 100)}%` : "";
              drawingsSummary.textContent = `${message}${progressText}`;
            },
          })
        : createTechnicalDrawing({
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
          }));

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
      logControllerError(error);
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
      logControllerError(error);
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

  function getProjectName() {
    return fileName.textContent && fileName.textContent !== "-" ? fileName.textContent : "BIM Manager Workbench";
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
    placeSpecificationsOnActiveSheet,
    exportSpecifications,
    syncDrawingSelectionFromModel,
    clearDrawings,
    persistDrawings,
  };
}
