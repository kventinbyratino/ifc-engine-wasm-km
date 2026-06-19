import { buildElementIndex, filterElementIndex, getUniqueValues, recordsToModelIdMap, type BimElementRecord } from "../data/element-index.ts";
import {
  exportElementsCsv,
  exportElementsJson,
  exportIfcFile as downloadIfcFile,
  fillSelectOptions,
  renderElementsTable,
} from "../data/data-browser.ts";
import { summarizeFederatedModels } from "../federation/federation.ts";
import {
  applyFederationFilters,
  normalizeFederationFilterState,
} from "../federation/federation-filters.ts";
import { createMessage } from "../ui/dom-utils.ts";
import type { ModelIdMap } from "../types.ts";
import { getFilteredElementCount, getIndexedElementCount } from "../state/workspace-state.ts";
import type { BimAppContext } from "./app-context.ts";
import { logControllerError } from "../ui/controller-errors.ts";

export interface DataControllerHooks {
  canUseDataBrowser: () => boolean;
  applySearchHighlight: (modelIdMap: ModelIdMap) => Promise<void>;
  fitToItems: (modelIdMap: ModelIdMap) => Promise<void>;
  setModelSelection: (modelIdMap: ModelIdMap) => Promise<void>;
  refreshClashSelectors: () => void;
  refreshFederationRegistry: () => void;
}

export function createDataController(ctx: BimAppContext, hooks: DataControllerHooks) {
  const { workspace } = ctx;
  const { fragments } = ctx.viewer;
  const {
    dataPanel,
    dataSummary,
    dataSearchInput,
    dataCategoryFilter,
    dataStoreyFilter,
    highlightFilteredBtn,
    dataTableOutput,
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
      const indexResult = await buildElementIndex({
        fragments,
        signal,
        itemReadTimeoutMs: 15000,
        onProgress: (processed, total) => {
          dataSummary.textContent = `Индексация: ${processed}/${total}`;
          ctx.setProgress(total > 0 ? processed / total : 0);
        },
      });
      workspace.data.elementIndex = indexResult.records;
      workspace.data.elementRelations = indexResult.relations;
      normalizeFederationFilterState(
        workspace.federation.filters,
        summarizeFederatedModels(workspace.data.elementIndex),
        workspace.data.elementIndex,
      );
      fillSelectOptions(dataCategoryFilter, getUniqueValues(workspace.data.elementIndex, "category"), "Все IFC Class");
      fillSelectOptions(dataStoreyFilter, getUniqueValues(workspace.data.elementIndex, "storey"), "Все этажи");
      applyDataFilters();
      hooks.refreshClashSelectors();
      hooks.refreshFederationRegistry();
      ctx.showToast(
        `BIM Data Index: ${getIndexedElementCount(workspace.data)} элементов · ${workspace.data.elementRelations.edges.length} связей`,
        "success",
      );
    } catch (error) {
      logControllerError(error);
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
    workspace.data.elementRelations = { edges: [], outgoing: {}, incoming: {} };
    workspace.data.progressiveLoadPlan = null;
    workspace.data.lodManifest = null;
    workspace.data.sourceIfcFiles = {};
    dataSummary.textContent = "Загрузите модель";
    dataSearchInput.value = "";
    fillSelectOptions(dataCategoryFilter, [], "Все IFC Class");
    fillSelectOptions(dataStoreyFilter, [], "Все этажи");
    dataTableOutput.replaceChildren(createMessage("Загрузите IFC или fragment."));
    hooks.refreshClashSelectors();
    hooks.refreshFederationRegistry();
  }

  function applyDataFilters() {
    const federatedRecords = applyFederationFilters(
      workspace.data.elementIndex,
      summarizeFederatedModels(workspace.data.elementIndex),
      workspace.federation.filters,
    );
    workspace.data.filteredElements = filterElementIndex(federatedRecords, {
      query: dataSearchInput.value,
      category: dataCategoryFilter.value,
      storey: dataStoreyFilter.value,
    });

    dataSummary.textContent = `${getFilteredElementCount(workspace.data)} из ${getIndexedElementCount(workspace.data)} элементов`;
    renderElementsTable({
      records: workspace.data.filteredElements,
      totalCount: workspace.data.filteredElements.length,
      output: dataTableOutput,
      activeSelection: workspace.viewer.activeSelection,
      onSelect: selectDataRecord,
    });
  }

  async function selectDataRecord(record: BimElementRecord) {
    const modelIdMap = recordsToModelIdMap([record]);
    await hooks.applySearchHighlight(modelIdMap);
    await hooks.fitToItems(modelIdMap);
    await hooks.setModelSelection(modelIdMap);
    ctx.setStatus(`Таблица → модель: ${record.modelId}:${record.localId}`);
  }

  function syncDataTableSelectionFromModel(modelIdMap: ModelIdMap) {
    renderElementsTable({
      records: workspace.data.filteredElements,
      totalCount: workspace.data.filteredElements.length,
      output: dataTableOutput,
      activeSelection: modelIdMap,
      onSelect: selectDataRecord,
    });

    const firstSelection = firstSelectedElement(modelIdMap);
    if (!firstSelection) return;
    const row = dataTableOutput.querySelector<HTMLElement>(
      `[data-model-id="${cssEscape(firstSelection.modelId)}"][data-local-id="${firstSelection.localId}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
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
    syncDataTableSelectionFromModel,
    selectDataRecord,
    highlightFilteredElements,
    exportElementsCsv,
    exportElementsJson,
    exportIfcFile: async (records: BimElementRecord[]) => {
      try {
        const file = await downloadIfcFile(records, workspace.ifcOverrides.pendingOverrides, workspace.data.sourceIfcFiles);
        ctx.showToast(`IFC export: ${file.fileName}`, "success");
      } catch (error) {
        ctx.showToast(error instanceof Error ? error.message : String(error), "error");
      }
    },
  };
}

function firstSelectedElement(modelIdMap: ModelIdMap) {
  for (const [modelId, localIds] of Object.entries(modelIdMap)) {
    const [localId] = localIds;
    if (typeof localId === "number") return { modelId, localId };
  }
  return null;
}

function cssEscape(value: string) {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/["\\]/g, "\\$&");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
