import * as THREE from "three";
import { MAX_IFC_BYTES } from "../config.ts";
import { createFederationLoadQueue } from "../federation/federation-loader.ts";
import { isolateFederationModel, removeFederationModel, restoreFederationVisibility, toggleFederationModelVisibility, updateFederationModelOpacity, getFederationModelById, noteFederationAction } from "../federation/federation-actions.ts";
import { applyFederationPreset, buildFederationFilterOptions, captureFederationPreset, removeFederationPreset, resetFederationFilters, setFederationFilterSelections } from "../federation/federation-filters.ts";
import { summarizeFederatedModels } from "../federation/federation.ts";
import { syncFederationRegistry } from "../federation/federation-registry.ts";
import type { FederationLoadSource } from "../federation/federation-registry.ts";
import { loadFragBuffer as loadFragmentsBuffer, loadIfcModel } from "../models/model-loader.ts";
import { isEmptySelection } from "../selection/selection.ts";
import { applyModelOpacity, applyModelVisibility } from "../viewer/viewer.ts";
import { renderFederationPanel } from "../ui/federation-panel.ts";
import type { BimAppContext } from "./app-context.ts";

export interface BimModelControllerOptions {
  ctx: BimAppContext;
  clearSearch: () => Promise<void>;
  clearDrawings: () => void;
  renderIssues: () => void;
  renderClash: () => void;
  applyDataFilters: () => void;
  refreshClashSelectors: () => void;
  resetDataIndex: () => void;
  resetChecks: () => void;
  clearBBoxIndex: () => void;
  setActiveShareRecord: (record: null) => void;
  closeLibraryModal: () => void;
  refreshFederationRegistry: () => void;
  persistFederationRegistry: () => void;
}

export function createModelController({
  ctx,
  clearSearch,
  clearDrawings,
  renderIssues,
  renderClash,
  applyDataFilters,
  refreshClashSelectors,
  resetDataIndex,
  resetChecks,
  clearBBoxIndex,
  setActiveShareRecord,
  closeLibraryModal,
  refreshFederationRegistry,
  persistFederationRegistry,
}: BimModelControllerOptions) {
  const { workspace, issueStore } = ctx;
  const { world, fragments, ifcLoader, highlighter, hider } = ctx.viewer;
  const {
    statusText,
    fileName,
    propertiesOutput,
    searchPanel,
    saveFragmentBtn,
    modelCount,
    loadIfcBtn,
    emptyBimState,
    searchToggleBtn,
    homeViewBtn,
    dataBrowserBtn,
    checksBtn,
    issuesBtn,
    clashBtn,
    drawingsBtn,
    federationBtn,
    federationPanel,
    federationSummary,
    federationOutput,
    dataPanel,
    checksPanel,
    issuesPanel,
    clashPanel,
    drawingsPanel,
  } = ctx.dom;
  const loadQueue = createFederationLoadQueue();

  async function loadIfc(file: File, source?: FederationLoadSource) {
    setActiveShareRecord(null);
    if (file.size > MAX_IFC_BYTES) {
      ctx.setStatus("IFC больше 200 МБ");
      ctx.showToast("IFC больше 200 МБ", "error");
      return;
    }

    await loadQueue.enqueue(async () => {
      ctx.setBusy(true, "Конвертация IFC в браузере");
      fileName.textContent = file.name;
      propertiesOutput.textContent = "IFC читается через web-ifc WASM. Серверная обработка не используется.";

      try {
        const result = await loadIfcModel({
          file,
          ifcLoader,
          source: source ?? {
            kind: "ifc",
            origin: "upload",
            label: file.name,
            reference: file.name,
            restorable: false,
          },
          onProgress: (value, process) => {
            ctx.setStatus(`${formatProcess(process)}: ${Math.round(value * 100)}%`);
            ctx.setProgress(value);
          },
        });

        workspace.viewer.lastConvertedModelId = result.modelId;
        workspace.viewer.lastSourceIfcName = result.sourceName;
        workspace.data.progressiveLoadPlan = result.progressivePlan;
        saveFragmentBtn.hidden = false;
        closeLibraryModal();
        refreshFederationState();
        ctx.setStatus(`IFC загружен и преобразован${result.source.restorable ? " · федерация сохранена" : ""}`);
        ctx.showToast("IFC загружен и преобразован", "success");
        ctx.setProgress(1);
      } catch (error) {
        refreshFederationState();
        ctx.showError(error);
      } finally {
        ctx.setBusy(false);
      }
    });
  }

  async function loadFrag(file: File) {
    setActiveShareRecord(null);
    ctx.setBusy(true, "Загрузка Fragments");
    fileName.textContent = file.name;

    try {
      await loadFragBuffer(await file.arrayBuffer(), file.name, {
        kind: "frag",
        origin: "upload",
        label: file.name,
        reference: file.name,
        restorable: false,
      });
      ctx.setStatus("FRAG загружен");
      ctx.showToast("FRAG загружен", "success");
      ctx.setProgress(1);
    } catch (error) {
      ctx.showError(error);
    } finally {
      ctx.setBusy(false);
    }
  }

  async function loadFragBuffer(buffer: ArrayBuffer, name: string, source?: FederationLoadSource) {
    return loadQueue.enqueue(async () => {
      ctx.setBusy(true, "Загрузка Fragments");
      fileName.textContent = name;

      try {
        const result = await loadFragmentsBuffer({
          buffer,
          name,
          fragments,
          camera: world.camera.three,
          source: source ?? {
            kind: "frag",
            origin: "upload",
            label: name,
            reference: name,
            restorable: false,
          },
          onProgress: (value, stage) => {
            ctx.setStatus(`${formatFragmentStage(stage)}: ${Math.round(value * 100)}%`);
            ctx.setProgress(value);
          },
        });
        refreshFederationState();
        workspace.data.progressiveLoadPlan = result.progressivePlan;
        ctx.setStatus(`FRAG загружен${result.source.restorable ? " · федерация сохранена" : ""}`);
        ctx.showToast("FRAG загружен", "success");
        ctx.setProgress(1);
        return result;
      } catch (error) {
        refreshFederationState();
        throw error;
      } finally {
        ctx.setBusy(false);
      }
    });
  }

  function refreshFederationState() {
    syncFederationRegistry({
      state: workspace.federation,
      models: fragments.list,
      records: workspace.data.elementIndex,
    });
    noteFederationAction(workspace.federation, "sync");
    workspace.viewer.lastFederationSyncAt = new Date().toISOString();
    persistFederationRegistry();
  }

  async function hideSelected() {
    if (isEmptySelection(workspace.viewer.activeSelection)) return;
    await hider.set(false, workspace.viewer.activeSelection);
    await highlighter.clear("select");
  }

  async function isolateSelected() {
    if (isEmptySelection(workspace.viewer.activeSelection)) return;
    await hider.isolate(workspace.viewer.activeSelection);
  }

  async function clearModels(options: { keepStatus?: boolean } = {}) {
    for (const [modelId] of fragments.list) {
      await fragments.core.disposeModel(modelId);
    }
    await highlighter.clear("select");
    await clearSearch();
    searchPanel.hidden = true;
    saveFragmentBtn.hidden = true;
    setActiveShareRecord(null);
    clearDrawings();
    issueStore.clear();
    renderIssues();
    workspace.clash.clashes = [];
    renderClash();
    clearBBoxIndex();
    resetDataIndex();
    resetChecks();
    fileName.textContent = "-";
    if (!options.keepStatus) ctx.setStatus("Загрузите IFC");
    refreshModelState();
  }

  async function downloadFragments() {
    if (fragments.list.size === 0) return;

    for (const [, model] of fragments.list) {
      const fragsBuffer = await model.getBuffer(true);
      const file = new File([fragsBuffer], `${model.modelId}.frag`);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  }

  async function fitToModels() {
    const objects = [...fragments.list.values()].map((model) => model.object);
    if (objects.length === 0) return;

    const box = new THREE.Box3();
    for (const object of objects) {
      object.updateWorldMatrix(true, true);
      box.expandByObject(object);
    }

    if (!box.isEmpty()) {
      await world.camera.controls.fitToBox(box, true, {
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
      });
    }
  }

  async function resetHomeView() {
    await world.camera.controls.setLookAt(24, 18, 24, 0, 0, 0, true);
    await fitToModels();
  }

  function refreshModelState() {
    refreshFederationState();
    applyFederationAppearance();
    renderFederationState();
    const hasModels = fragments.list.size > 0;
    workspace.viewer.visibleChunkIds = workspace.data.progressiveLoadPlan?.stages.flatMap((stage) => stage.chunkIds) ?? [];
    workspace.viewer.lastVisibilityUpdateAt = hasModels ? new Date().toISOString() : "";
    const capabilities = ctx.getCapabilities();
    const showBimEmptyState = !hasModels && workspace.viewer.activeProfile === "bim";
    modelCount.textContent = String(fragments.list.size);
    emptyBimState.hidden = !showBimEmptyState;
    loadIfcBtn.hidden = hasModels || showBimEmptyState;
    searchToggleBtn.hidden = !hasModels;
    homeViewBtn.hidden = !hasModels;
    federationBtn.hidden = !hasModels || !capabilities.coordination;
    dataBrowserBtn.hidden = !hasModels || !capabilities.dataBrowser;
    checksBtn.hidden = !hasModels || !capabilities.qaQc;
    issuesBtn.hidden = !hasModels || !capabilities.issues;
    clashBtn.hidden = !hasModels || !capabilities.coordination;
    drawingsBtn.hidden = !hasModels || !capabilities.drawings;
    if (!hasModels || !capabilities.coordination) federationPanel.hidden = true;
    if (!hasModels || !capabilities.dataBrowser) dataPanel.hidden = true;
    if (!hasModels || !capabilities.qaQc) checksPanel.hidden = true;
    if (!hasModels || !capabilities.issues) issuesPanel.hidden = true;
    if (!hasModels || !capabilities.coordination) clashPanel.hidden = true;
    if (!hasModels || !capabilities.drawings) drawingsPanel.hidden = true;
  }

  function renderFederationState() {
    const federationModels = summarizeFederatedModels(workspace.data.elementIndex);
    renderFederationPanel({
      models: workspace.federation.models,
      summary: ctx.dom.federationSummary,
      output: ctx.dom.federationOutput,
      filters: workspace.federation.filters,
      filterOptions: buildFederationFilterOptions(federationModels, workspace.data.elementIndex, workspace.federation.filters),
      actions: {
        onClose: closeFederationPanel,
        onShowAll: showAllFederationModels,
        onToggleVisibility: toggleFederationModel,
        onOpacityChange: setFederationModelOpacityValue,
        onFocus: focusFederationModel,
        onIsolate: isolateFederationModelAction,
        onRemove: removeFederationModelFromScene,
        onUpdateFilters: updateFederationFilters,
        onApplyPreset: applyFederationPresetAction,
        onSavePreset: saveFederationPresetAction,
        onDeletePreset: deleteFederationPresetAction,
        onResetFilters: resetFederationFiltersAction,
      },
    });
  }

  function updateFederationFilters(selections: Parameters<typeof setFederationFilterSelections>[1]) {
    setFederationFilterSelections(workspace.federation.filters, selections);
    workspace.federation.filters.activePresetId = "custom";
    noteFederationAction(workspace.federation, "update-filters");
    renderFederationState();
    applyDataFilters();
    refreshClashSelectors();
    renderClash();
  }

  function applyFederationPresetAction(presetId: string) {
    if (!applyFederationPreset(workspace.federation.filters, presetId)) return;
    noteFederationAction(workspace.federation, "apply-preset");
    renderFederationState();
    applyDataFilters();
    refreshClashSelectors();
    renderClash();
  }

  function saveFederationPresetAction(label: string) {
    const preset = captureFederationPreset(workspace.federation.filters, label);
    const existing = workspace.federation.filters.presets.findIndex((item) => item.id === preset.id);
    if (existing >= 0) {
      workspace.federation.filters.presets[existing] = preset;
    } else {
      workspace.federation.filters.presets.push(preset);
    }
    workspace.federation.filters.activePresetId = preset.id;
    noteFederationAction(workspace.federation, "save-preset");
    renderFederationState();
  }

  function deleteFederationPresetAction(presetId: string) {
    if (!removeFederationPreset(workspace.federation.filters, presetId)) return;
    noteFederationAction(workspace.federation, "delete-preset");
    renderFederationState();
    applyDataFilters();
    refreshClashSelectors();
    renderClash();
  }

  function resetFederationFiltersAction() {
    resetFederationFilters(workspace.federation.filters);
    noteFederationAction(workspace.federation, "reset-filters");
    renderFederationState();
    applyDataFilters();
    refreshClashSelectors();
    renderClash();
  }

  function applyFederationAppearance() {
    for (const model of workspace.federation.models) {
      const runtime = fragments.list.get(model.modelId) as unknown as { object?: THREE.Object3D } | undefined;
      applyModelVisibility(runtime, model.visible);
      applyModelOpacity(runtime, model.opacity);
    }
  }

  function toggleFederationPanel() {
    federationPanel.hidden = !federationPanel.hidden;
    if (!federationPanel.hidden) renderFederationState();
  }

  function closeFederationPanel() {
    federationPanel.hidden = true;
  }

  function showAllFederationModels() {
    restoreFederationVisibility(workspace.federation);
    noteFederationAction(workspace.federation, "show-all");
    applyFederationAppearance();
    persistFederationRegistry();
    renderFederationState();
    ctx.setStatus("Все модели федерации показаны");
  }

  function toggleFederationModel(modelId: string) {
    toggleFederationModelVisibility(workspace.federation, modelId);
    noteFederationAction(workspace.federation, "toggle-visibility");
    applyFederationAppearance();
    persistFederationRegistry();
    renderFederationState();
  }

  function setFederationModelOpacityValue(modelId: string, opacity: number) {
    updateFederationModelOpacity(workspace.federation, modelId, opacity);
    noteFederationAction(workspace.federation, "set-opacity");
    applyFederationAppearance();
    persistFederationRegistry();
    renderFederationState();
  }

  async function focusFederationModel(modelId: string) {
    const runtime = fragments.list.get(modelId);
    const object = runtime?.object;
    if (!object) return;
    noteFederationAction(workspace.federation, "focus");
    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    await world.camera.controls.fitToBox(box, true, {
      paddingLeft: 1,
      paddingRight: 1,
      paddingTop: 1,
      paddingBottom: 1,
    });
  }

  function isolateFederationModelAction(modelId: string) {
    isolateFederationModel(workspace.federation, modelId);
    noteFederationAction(workspace.federation, "isolate");
    applyFederationAppearance();
    persistFederationRegistry();
    renderFederationState();
  }

  async function removeFederationModelFromScene(modelId: string) {
    await fragments.core.disposeModel(modelId);
    removeFederationModel(workspace.federation, modelId);
    noteFederationAction(workspace.federation, "remove");
    applyFederationAppearance();
    persistFederationRegistry();
    refreshModelState();
  }

  return {
    loadIfc,
    loadFrag,
    loadFragBuffer,
    hideSelected,
    isolateSelected,
    clearModels,
    downloadFragments,
    fitToModels,
    resetHomeView,
    refreshModelState,
    toggleFederationPanel,
    closeFederationPanel,
    showAllFederationModels,
    toggleFederationModel,
    setFederationModelOpacityValue,
    focusFederationModel,
    isolateFederationModelAction,
    removeFederationModelFromScene,
  };
}

function formatProcess(process: string) {
  const labels: Record<string, string> = {
    geometries: "Геометрия",
    attributes: "Атрибуты",
    relations: "Связи",
    conversion: "Конвертация",
  };
  return labels[process] ?? process;
}

function formatFragmentStage(stage: string) {
  const labels: Record<string, string> = {
    decompressing: "Распаковка fragment",
    parsing: "Чтение fragment",
    generating: "Построение сцены",
    done: "Fragment загружен",
  };
  return labels[stage] ?? "Загрузка fragment";
}
