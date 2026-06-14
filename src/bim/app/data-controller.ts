import { renderSelectedProperties } from "../properties/properties-panel";
import {
  buildModelIndex,
  filterModelIndex,
  getUniqueValues,
  recordsToModelIdMap,
  type BimElementRecord,
} from "../data/model-index";
import {
  exportElementsCsv,
  exportElementsJson,
  fillSelectOptions,
  renderElementsTable,
} from "../data/data-browser";
import { createMessage } from "../ui/dom-utils";
import type { ModelIdMap } from "../types";
import { getFilteredElementCount, getIndexedElementCount } from "../state/workspace-state";
import type { BimAppContext } from "./app-context";

export interface DataControllerHooks {
  canUseDataBrowser: () => boolean;
  applySearchHighlight: (modelIdMap: ModelIdMap) => Promise<void>;
  fitToItems: (modelIdMap: ModelIdMap) => Promise<void>;
  refreshClashSelectors: () => void;
}

export function createDataController(ctx: BimAppContext, hooks: DataControllerHooks) {
  const { workspace } = ctx;
  const { components, fragments } = ctx.viewer;
  const {
    dataPanel,
    dataSummary,
    dataSearchInput,
    dataCategoryFilter,
    dataStoreyFilter,
    highlightFilteredBtn,
    dataTableOutput,
    propertiesOutput,
    selectionCount,
  } = ctx.dom;

  function toggleDataPanel() {
    if (dataPanel.hidden) {
      openDataPanel();
      return;
    }

    closeDataPanel();
  }

  function openDataPanel() {
    if (!hooks.canUseDataBrowser()) {
      dataPanel.hidden = true;
      ctx.setStatus("BIM Data Browser доступен только в профиле BIM");
      ctx.showToast("BIM Data Browser доступен только в профиле BIM", "error");
      return;
    }

    dataPanel.hidden = false;
    if (getIndexedElementCount(workspace.data) === 0 && fragments.list.size > 0) {
      void rebuildDataIndex();
      return;
    }
    applyDataFilters();
  }

  function closeDataPanel() {
    dataPanel.hidden = true;
  }

  async function rebuildDataIndex() {
    if (!hooks.canUseDataBrowser()) {
      resetDataIndex();
      return;
    }

    if (fragments.list.size === 0) {
      resetDataIndex();
      return;
    }

    dataSummary.textContent = "Индексация элементов...";
    dataTableOutput.replaceChildren(createMessage("Сбор IFC атрибутов..."));
    const signal = ctx.startOperation("Индексация элементов");

    try {
      workspace.data.elementIndex = await buildModelIndex({
        fragments,
        signal,
        onProgress: (processed, total) => {
          dataSummary.textContent = `Индексация: ${processed}/${total}`;
          ctx.setProgress(total > 0 ? processed / total : 0);
        },
      });
      fillSelectOptions(dataCategoryFilter, getUniqueValues(workspace.data.elementIndex, "category"), "Все IFC Class");
      fillSelectOptions(dataStoreyFilter, getUniqueValues(workspace.data.elementIndex, "storey"), "Все этажи");
      applyDataFilters();
      hooks.refreshClashSelectors();
      ctx.showToast(`BIM Data Index: ${getIndexedElementCount(workspace.data)} элементов`, "success");
    } catch (error) {
      console.error(error);
      if (isAbortError(error)) {
        dataSummary.textContent = "Индексация отменена";
        dataTableOutput.replaceChildren(createMessage("Операция отменена."));
        ctx.setStatus("Индексация отменена");
        return;
      }
      dataSummary.textContent = "Ошибка индексации";
      dataTableOutput.replaceChildren(
        createMessage(error instanceof Error ? error.message : String(error)),
      );
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    } finally {
      ctx.finishOperation(signal);
    }
  }

  function resetDataIndex() {
    workspace.data.elementIndex = [];
    workspace.data.filteredElements = [];
    dataSummary.textContent = "Загрузите модель";
    dataSearchInput.value = "";
    fillSelectOptions(dataCategoryFilter, [], "Все IFC Class");
    fillSelectOptions(dataStoreyFilter, [], "Все этажи");
    dataTableOutput.replaceChildren(createMessage("Загрузите IFC или fragment."));
    hooks.refreshClashSelectors();
  }

  function applyDataFilters() {
    workspace.data.filteredElements = filterModelIndex(workspace.data.elementIndex, {
      query: dataSearchInput.value,
      category: dataCategoryFilter.value,
      storey: dataStoreyFilter.value,
    });

    dataSummary.textContent = `${getFilteredElementCount(workspace.data)} из ${getIndexedElementCount(workspace.data)} элементов`;
    renderElementsTable({
      records: workspace.data.filteredElements,
      totalCount: workspace.data.filteredElements.length,
      output: dataTableOutput,
      onSelect: selectDataRecord,
    });
  }

  async function selectDataRecord(record: BimElementRecord) {
    const modelIdMap = recordsToModelIdMap([record]);
    await hooks.applySearchHighlight(modelIdMap);
    await hooks.fitToItems(modelIdMap);
    await renderSelectedProperties({ components, modelIdMap, output: propertiesOutput });
    workspace.viewer.activeSelection = modelIdMap;
    selectionCount.textContent = "1";
  }

  async function highlightFilteredElements() {
    if (getFilteredElementCount(workspace.data) === 0) return;
    highlightFilteredBtn.loading = true;
    try {
      const limitedRecords = workspace.data.filteredElements.slice(0, 1500);
      const modelIdMap = recordsToModelIdMap(limitedRecords);
      await hooks.applySearchHighlight(modelIdMap);
      await hooks.fitToItems(modelIdMap);
      ctx.setStatus(`Подсвечено элементов: ${limitedRecords.length}`);
      ctx.showToast(`Подсвечено элементов: ${limitedRecords.length}`, "success");
    } finally {
      highlightFilteredBtn.loading = false;
    }
  }

  return {
    toggleDataPanel,
    openDataPanel,
    closeDataPanel,
    rebuildDataIndex,
    resetDataIndex,
    applyDataFilters,
    selectDataRecord,
    highlightFilteredElements,
    exportElementsCsv,
    exportElementsJson,
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
