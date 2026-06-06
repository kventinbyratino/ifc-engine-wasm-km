import { renderSelectedProperties } from "../properties/properties-panel";
import {
  buildElementIndex,
  filterElementIndex,
  getUniqueValues,
  recordsToModelIdMap,
  type BimElementRecord,
} from "../data/element-index";
import {
  exportElementsCsv,
  exportElementsJson,
  fillSelectOptions,
  renderElementTable,
} from "../data/data-browser";
import { createMessage } from "../ui/dom-utils";
import type { ModelIdMap } from "../types";
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
      return;
    }

    dataPanel.hidden = false;
    if (workspace.elementIndex.length === 0 && fragments.list.size > 0) {
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

    try {
      workspace.elementIndex = await buildElementIndex({
        fragments,
        onProgress: (processed, total) => {
          dataSummary.textContent = `Индексация: ${processed}/${total}`;
        },
      });
      fillSelectOptions(dataCategoryFilter, getUniqueValues(workspace.elementIndex, "category"), "Все IFC Class");
      fillSelectOptions(dataStoreyFilter, getUniqueValues(workspace.elementIndex, "storey"), "Все этажи");
      applyDataFilters();
      hooks.refreshClashSelectors();
    } catch (error) {
      console.error(error);
      dataSummary.textContent = "Ошибка индексации";
      dataTableOutput.replaceChildren(
        createMessage(error instanceof Error ? error.message : String(error)),
      );
    }
  }

  function resetDataIndex() {
    workspace.elementIndex = [];
    workspace.filteredElements = [];
    dataSummary.textContent = "Загрузите модель";
    dataSearchInput.value = "";
    fillSelectOptions(dataCategoryFilter, [], "Все IFC Class");
    fillSelectOptions(dataStoreyFilter, [], "Все этажи");
    dataTableOutput.replaceChildren(createMessage("Загрузите IFC или fragment."));
    hooks.refreshClashSelectors();
  }

  function applyDataFilters() {
    workspace.filteredElements = filterElementIndex(workspace.elementIndex, {
      query: dataSearchInput.value,
      category: dataCategoryFilter.value,
      storey: dataStoreyFilter.value,
    });

    dataSummary.textContent = `${workspace.filteredElements.length} из ${workspace.elementIndex.length} элементов`;
    renderElementTable({
      records: workspace.filteredElements,
      totalCount: workspace.filteredElements.length,
      output: dataTableOutput,
      onSelect: selectDataRecord,
    });
  }

  async function selectDataRecord(record: BimElementRecord) {
    const modelIdMap = recordsToModelIdMap([record]);
    await hooks.applySearchHighlight(modelIdMap);
    await hooks.fitToItems(modelIdMap);
    await renderSelectedProperties({ components, modelIdMap, output: propertiesOutput });
    workspace.activeSelection = modelIdMap;
    selectionCount.textContent = "1";
  }

  async function highlightFilteredElements() {
    if (workspace.filteredElements.length === 0) return;
    highlightFilteredBtn.loading = true;
    try {
      const limitedRecords = workspace.filteredElements.slice(0, 1500);
      const modelIdMap = recordsToModelIdMap(limitedRecords);
      await hooks.applySearchHighlight(modelIdMap);
      await hooks.fitToItems(modelIdMap);
      ctx.setStatus(`Подсвечено элементов: ${limitedRecords.length}`);
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
