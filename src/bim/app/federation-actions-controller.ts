import * as THREE from "three";
import {
  applyFederationPreset,
  buildFederationFilterOptions,
  captureFederationPreset,
  removeFederationPreset,
  resetFederationFilters,
  setFederationFilterSelections,
} from "../federation/federation-filters.ts";
import { summarizeFederatedModels } from "../federation/federation.ts";
import {
  isolateFederationModel,
  removeFederationModel,
  restoreFederationVisibility,
  toggleFederationModelVisibility,
  updateFederationModelOpacity,
  noteFederationAction,
} from "../federation/federation-actions.ts";
import { applyModelOpacity, applyModelVisibility } from "../viewer/viewer.ts";
import { renderFederationPanel } from "../ui/federation-panel.ts";
import type { BimAppContext } from "./app-context.ts";

export interface FederationActionsControllerOptions {
  ctx: BimAppContext;
  applyDataFilters: () => void;
  refreshClashSelectors: () => void;
  renderClash: () => void;
  refreshModelState: () => void;
  persistFederationRegistry: () => void;
}

export interface FederationActionsController {
  applyFederationAppearance: () => void;
  renderFederationState: () => void;
  toggleFederationPanel: () => void;
  closeFederationPanel: () => void;
  showAllFederationModels: () => void;
  toggleFederationModel: (modelId: string) => void;
  setFederationModelOpacityValue: (modelId: string, opacity: number) => void;
  focusFederationModel: (modelId: string) => Promise<void>;
  isolateFederationModelAction: (modelId: string) => void;
  removeFederationModelFromScene: (modelId: string) => Promise<void>;
}

export function createFederationActionsController({
  ctx,
  applyDataFilters,
  refreshClashSelectors,
  renderClash,
  refreshModelState,
  persistFederationRegistry,
}: FederationActionsControllerOptions): FederationActionsController {
  const { workspace } = ctx;
  const { world, fragments } = ctx.viewer;
  const {
    federationPanel,
    federationSummary,
    federationOutput,
  } = ctx.dom;

  function applyFederationAppearance() {
    for (const model of workspace.federation.models) {
      const runtime = fragments.list.get(model.modelId) as unknown as { object?: THREE.Object3D } | undefined;
      applyModelVisibility(runtime, model.visible);
      applyModelOpacity(runtime, model.opacity);
    }
  }

  function renderFederationState() {
    const federationModels = summarizeFederatedModels(workspace.data.elementIndex);
    renderFederationPanel({
      models: workspace.federation.models,
      summary: federationSummary,
      output: federationOutput,
      filters: workspace.federation.filters,
      filterOptions: buildFederationFilterOptions(
        federationModels,
        workspace.data.elementIndex,
        workspace.federation.filters,
      ),
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
    applyFederationAppearance,
    renderFederationState,
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
