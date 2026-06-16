import * as THREE from "three";
import { noteFederationAction } from "../federation/federation-actions.ts";
import { syncFederationRegistry } from "../federation/federation-registry.ts";
import { isEmptySelection } from "../selection/selection.ts";
import { createVisibilityIndex } from "../performance/visibility-index.ts";
import { getViewerCameraQuery } from "../viewer/viewer.ts";
import type { BimAppContext } from "./app-context.ts";
import { createFederationActionsController, type FederationActionsController } from "./federation-actions-controller.ts";
import { createModelLoadController } from "./model-load-controller.ts";
import { createModelResetService } from "./model-reset-service.ts";

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
  const { world, fragments, highlighter, hider } = ctx.viewer;
  const {
    fileName,
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
    dataPanel,
    checksPanel,
    issuesPanel,
    clashPanel,
    drawingsPanel,
  } = ctx.dom;

  let federationActionsController: FederationActionsController;

  const modelLoadController = createModelLoadController(ctx, {
    setActiveShareRecord,
    closeLibraryModal,
    refreshFederationState,
  });
  const modelResetService = createModelResetService({
    ctx,
    clearSearch,
    clearDrawings,
    renderIssues,
    renderClash,
    clearBBoxIndex,
    resetDataIndex,
    resetChecks,
    setActiveShareRecord,
    refreshModelState,
  });
  federationActionsController = createFederationActionsController({
    ctx,
    applyDataFilters,
    refreshClashSelectors,
    renderClash,
    refreshModelState,
    persistFederationRegistry,
  });

  const { loadIfc, loadFrag, loadFragBuffer } = modelLoadController;
  const { clearModels } = modelResetService;
  const {
    toggleFederationPanel,
    closeFederationPanel,
  } = federationActionsController;

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
    federationActionsController.applyFederationAppearance();
    federationActionsController.renderFederationState();
    const hasModels = fragments.list.size > 0;
    const progressivePlan = workspace.data.progressiveLoadPlan;
    if (progressivePlan?.manifest) {
      const visibilityIndex = createVisibilityIndex(progressivePlan.manifest.chunks);
      const camera = world.camera.three;
      const target = (world.camera.controls as { target?: THREE.Vector3 }).target ?? new THREE.Vector3();
      const selectedElements = Object.entries(workspace.viewer.activeSelection).flatMap(([modelId, localIds]) =>
        [...localIds].map((localId) => ({ modelId, localId })),
      );
      const visibility = visibilityIndex.queryVisible({
        ...getViewerCameraQuery(camera, target, 80),
        selectedElements,
      });
      workspace.viewer.visibleChunkIds = visibility.chunkIds;
      workspace.viewer.lastVisibilityUpdateAt = hasModels ? new Date().toISOString() : "";
    } else {
      workspace.viewer.visibleChunkIds = progressivePlan?.stages.flatMap((stage) => stage.chunkIds) ?? [];
      workspace.viewer.lastVisibilityUpdateAt = hasModels ? new Date().toISOString() : "";
    }
    const capabilities = ctx.getCapabilities();
    const showBimEmptyState = !hasModels && workspace.viewer.activeProfile === "bim";
    modelCount.textContent = String(fragments.list.size);
    emptyBimState.hidden = !showBimEmptyState;
    loadIfcBtn.hidden = showBimEmptyState;
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
  };
}
