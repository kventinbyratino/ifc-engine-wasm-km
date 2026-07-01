import workerUrl from "@thatopen/fragments/worker?url";
import "../../styles.css";
import { APP_BASE, API_BASE } from "../config.ts";
import { getDomElements } from "../dom.ts";
import { renderSelectedProperties } from "../properties/properties-panel.ts";
import { countSelection, isEmptySelection, mergeModelIdMaps } from "../selection/selection.ts";
import { createWorkspaceState } from "../state/workspace-state.ts";
import { createDrawingInteractionController } from "../drawings/drawing-interaction.ts";
import { syncDrawingAnnotations, type DrawingAnnotationType } from "../drawings/drawing-annotations.ts";
import { syncFederationRegistry } from "../federation/federation-registry.ts";
import { normalizeFederationFilterState } from "../federation/federation-filters.ts";
import { summarizeFederatedModels } from "../federation/federation.ts";
import { saveFederationSnapshot } from "../federation/federation-snapshot.ts";
import { bindBimUiEvents } from "./ui-wiring.ts";
import { createIssueStore } from "../issues/issues-store.ts";
import { createMessage } from "../ui/dom-utils.ts";
import type { ModelIdMap } from "../types.ts";
import type { ModelLoadReportDraft } from "../performance/load-report.ts";
import { createModelLoadReport } from "../performance/load-report.ts";
import { createBimViewer } from "../viewer/viewer.ts";
import { mountSpatialTree } from "../tree/spatial-tree.ts";
import type { BimAppContext } from "./app-context.ts";
import { createAppStatusController } from "./app-status.ts";
import { createBimAppContext } from "./app-context-factory.ts";
import { restoreStoredFederationState, createFederationWorkspaceRestorer } from "./federation-restore.ts";
import { createIfcOverridesWiring } from "./ifc-overrides-wiring.ts";
import { createControllerRegistry } from "./controller-registry.ts";
import { createProfileRouter } from "./profile-router.ts";
import { stripKmProfileChrome } from "./km-shell-chrome.ts";
import { createModelController } from "./model-controller.ts";
import { createShareController } from "./share-controller.ts";
import { createLoadReportController } from "./load-report-controller.ts";
import { createLibraryController } from "./library-controller.ts";
import { createSearchController } from "./search-controller.ts";
import { createDataController } from "./data-controller.ts";
import { createChecksController } from "./checks-controller.ts";
import { createIssuesController } from "./issues-controller.ts";
import { createClashController } from "./clash-controller.ts";
import { createDrawingsController } from "./drawings-controller.ts";
import { renderHelpPage } from "../help/help-page.ts";
import { createElementContextMenu } from "../ui/element-context-menu.ts";

export async function startBimApp() {
  const {
    app,
    profileKmBtn,
    profileBimBtn,
    backToProfilesBtn,
    bimStub,
    statusText,
    loadingOverlay,
    loadingStatus,
    loadingCancelBtn,
    fileName,
    modelCount,
    selectionCount,
    propertiesPanel,
    closePropertiesPanelBtn,
    propertiesOutput,
    treeOutput,
    searchInput,
    searchOutput,
    searchPanel,
    progress,
    progressBar,
    viewport,
    libraryModal,
    libraryStart,
    libraryListPanel,
    fragmentList,
    exampleList,
    closeLibraryBtn,
    chooseFragmentBtn,
    addIfcBtn,
    libraryBackBtn,
    saveFragmentBtn,
    shareModelBtn,
    shareModal,
    shareLinkInput,
    shareModelName,
    shareCopyStatus,
    closeShareBtn,
    copyShareBtn,
    topBackBtn,
    ifcInput,
    fragInput,
    loadIfcBtn,
    emptyLoadIfcBtn,
    emptyExampleBtn,
    emptyLibraryBtn,
    loadFragBtn,
    fitBtn,
    clearBtn,
    downloadFragBtn,
    hideSelectedBtn,
    isolateSelectedBtn,
    showAllBtn,
    searchToggleBtn,
    homeViewBtn,
    dataBrowserBtn,
    checksBtn,
    issuesBtn,
    clashBtn,
    drawingsBtn,
    helpPage,
    helpPageOutput,
    dataPanel,
    dataSummary,
    closeDataPanelBtn,
    dataSearchInput,
    dataCategoryFilter,
    dataStoreyFilter,
    highlightFilteredBtn,
    exportCsvBtn,
    exportJsonBtn,
    dataTableOutput,
    checksPanel,
    checksSummary,
    closeChecksPanelBtn,
    runChecksBtn,
    idsFileInput,
    idsTitleInput,
    idsSpecNameInput,
    idsEntityInput,
    idsPsetInput,
    idsPropertyInput,
    addIdsRequirementBtn,
    saveIdsBtn,
    exportChecksCsvBtn,
    exportChecksJsonBtn,
    checksOutput,
    issuesPanel,
    issuesSummary,
    closeIssuesPanelBtn,
    createIssueBtn,
    exportIssuesJsonBtn,
    exportIssuesBcfBtn,
    clearIssuesBtn,
    issuesOutput,
    clashPanel,
    clashSummary,
    closeClashPanelBtn,
    clashGroupASelect,
    clashGroupBSelect,
    clashToleranceInput,
    runClashBtn,
    clearClashBtn,
    clashOutput,
    drawingsPanel,
    drawingsSummary,
    closeDrawingsPanelBtn,
    drawingSourceSelect,
    drawingViewSelect,
    drawingFarInput,
    sheetFormatSelect,
    annotationTypeSelect,
    annotationTextInput,
    addAnnotationBtn,
    interactiveAnnotationBtn,
    clearAnnotationsBtn,
    createSheetBtn,
    placeSpecsBtn,
    exportSheetSvgBtn,
    exportSheetPngBtn,
    exportSheetPdfBtn,
    exportSheetDxfBtn,
    exportSpecsBtn,
    generateDrawingBtn,
    clearDrawingsBtn,
    drawingsOutput,
    searchBtn,
    clearSearchBtn,
  } = getDomElements();

  const { components, world, fragments, ifcLoader, highlighter, hider, lodChunkCache } = await createBimViewer({
    viewport,
    workerUrl,
    appBase: APP_BASE,
  });

  mountSpatialTree({
    components,
    models: fragments.list.values(),
    output: treeOutput,
  });

  const workspace = createWorkspaceState();
  const { storedFederationWorkspace } = restoreStoredFederationState(workspace);
  const issueStore = createIssueStore();
  const appStatus = createAppStatusController(getDomElements());
  let pendingLoadReportDraft: ModelLoadReportDraft | null = null;
  const {
    ifcOverrideStore,
    syncIfcOverrideState,
    savePropertyOverride,
    removeOverride,
    clearOverrides,
  } = createIfcOverridesWiring({
    dom: getDomElements(),
    viewer: { components, world, fragments, ifcLoader, highlighter, hider, lodChunkCache },
    workspace,
    showToast: appStatus.showToast,
  });
  const ctx: BimAppContext = createBimAppContext({
    dom: getDomElements(),
    viewer: { components, world, fragments, ifcLoader, highlighter, hider, lodChunkCache },
    workspace,
    issueStore,
    ifcOverrideStore,
    syncIfcOverrideState,
    savePropertyOverride,
    setStatus: appStatus.setStatus,
    setBusy: appStatus.setBusy,
    setProgress: appStatus.setProgress,
    startOperation: appStatus.startOperation,
    finishOperation: appStatus.finishOperation,
    showToast: appStatus.showToast,
    showError: appStatus.showError,
  });
  void ctx;
  renderHelpPage(helpPageOutput);
  const openHelpPage = () => {
    helpPage.hidden = false;
    helpPage.classList.add("is-open");
    ctx.setStatus("Открыта справка");
  };
  const closeHelpPage = () => {
    helpPage.hidden = true;
    helpPage.classList.remove("is-open");
  };

  const openPropertiesPanel = () => {
    if (countSelection(workspace.viewer.activeSelection) === 0) {
      ctx.showToast("Сначала выберите элемент", "error");
      return;
    }

    propertiesPanel.hidden = false;
    propertiesPanel.classList.add("is-open");
    ctx.setStatus("Открыты свойства элемента");
  };

  const closePropertiesPanel = () => {
    propertiesPanel.hidden = true;
    propertiesPanel.classList.remove("is-open");
  };
  closePropertiesPanelBtn.onclick = closePropertiesPanel;
  const drawingInteraction = createDrawingInteractionController({
    viewport,
    world,
    components,
    getActiveDrawing: () => workspace.drawings.drawings[0] ?? null,
    getAnnotationType: () => annotationTypeSelect.value as DrawingAnnotationType,
    getAnnotationText: () => annotationTextInput.value,
    onAnnotationAdded: (record) => {
      annotationTextInput.value = "";
      syncDrawingAnnotations(components, record);
      persistDrawings();
      renderDrawingsPanel();
    },
    onStatus: (message) => {
      drawingsSummary.textContent = message;
      statusText.textContent = message;
    },
  });

  const {
    openShareModal,
    closeShareModal,
    copyShareLink,
    setActiveShareRecord,
  } = createShareController(ctx);

  const {
    openLoadReportModal,
    closeLoadReportModal,
  } = createLoadReportController(ctx);
  ctx.dom.closeLoadReportBtn.onclick = closeLoadReportModal;
  let canUseDataBrowser = () => false;
  let canUseDrawings = () => false;
  let canUseChecks = () => false;
  let canUseIssues = () => false;
  let canUseCoordination = () => false;

  const controllerRegistry = createControllerRegistry();
  const closeLibraryModal = () => controllerRegistry.close("library");
  const closeDataPanel = () => controllerRegistry.close("data");
  const closeChecksPanel = () => controllerRegistry.close("checks");
  const closeIssuesPanel = () => controllerRegistry.close("issues");
  const closeClashPanel = () => controllerRegistry.close("clash");
  const closeDrawingsPanel = () => controllerRegistry.close("drawings");
  const refreshClashSelectors = () => controllerRegistry.refresh("clash");
  const renderClash = () => controllerRegistry.render("clash");
  const clearBBoxIndex = () => controllerRegistry.reset("clash");
  const renderIssues = () => controllerRegistry.render("issues");
  const clearDrawings = () => controllerRegistry.reset("drawings");
  const resetDataIndex = () => controllerRegistry.reset("data");
  const resetChecks = () => controllerRegistry.reset("checks");
  const persistDrawings = () => controllerRegistry.persist("drawings");
  const refreshFederationRegistry = () => {
    syncFederationRegistry({
      state: workspace.federation,
      models: fragments.list,
      records: workspace.data.elementIndex,
    });
    normalizeFederationFilterState(
      workspace.federation.filters,
      summarizeFederatedModels(workspace.data.elementIndex),
      workspace.data.elementIndex,
    );
    workspace.viewer.lastFederationSyncAt = new Date().toISOString();
    saveFederationSnapshot(workspace);
  };
  const persistFederationRegistry = () => saveFederationSnapshot(workspace);
  const renderDrawingsPanel = () => controllerRegistry.render("drawings");

  const searchController = createSearchController(ctx);
  const {
    searchItems,
    toggleSearchPanel,
    expandSearchPanel,
    closeSearchPanel,
    clearSearch,
    applySearchHighlight,
    fitToItems,
    getGeometryItemsMap,
  } = searchController;

  const dataController = createDataController(ctx, {
    canUseDataBrowser: () => canUseDataBrowser(),
    applySearchHighlight,
    fitToItems,
    setModelSelection,
    refreshClashSelectors: () => refreshClashSelectors(),
    refreshFederationRegistry,
  });
  const {
    toggleDataPanel,
    openDataPanel,
    applyDataFilters,
    syncDataTableSelectionFromModel,
    rebuildDataIndex,
    selectDataRecord,
    highlightFilteredElements,
    exportElementsCsv,
    exportElementsJson,
    exportIfcFile,
  } = dataController;
  controllerRegistry.register("data", {
    close: dataController.closeDataPanel,
    reset: dataController.resetDataIndex,
  });

  const issuesController = createIssuesController(ctx, {
    canUseIssues: () => canUseIssues(),
    rebuildDataIndex,
    selectDataRecord,
  });
  const {
    toggleIssuesPanel,
    createIssueFromSelection,
    createIssueFromHealthCheck,
    exportIssuesJson,
    exportIssuesBcfLikeJson,
    captureCamera,
  } = issuesController;
  controllerRegistry.register("issues", {
    close: issuesController.closeIssuesPanel,
    render: issuesController.renderIssues,
  });

  const checksController = createChecksController(ctx, {
    canUseChecks: () => canUseChecks(),
    rebuildDataIndex,
    selectDataRecord,
    createIssueFromHealthCheck,
    downloadTextFile,
  });
  const {
    toggleChecksPanel,
    loadIDSFile,
    addIDSRequirementFromForm,
    saveIDSFile,
    runChecks,
    exportChecksCsv,
    exportChecksJson,
  } = checksController;
  controllerRegistry.register("checks", {
    close: checksController.closeChecksPanel,
    reset: checksController.resetChecks,
  });

  const clashController = createClashController(ctx, {
    canUseCoordination: () => canUseCoordination(),
    rebuildDataIndex,
    applySearchHighlight,
    fitToItems,
    renderIssues: () => renderIssues(),
    captureCamera,
  });
  const { toggleClashPanel, runClashDetection } = clashController;
  controllerRegistry.register("clash", {
    close: clashController.closeClashPanel,
    render: clashController.renderClash,
    reset: clashController.clearBBoxIndex,
    refresh: clashController.refreshClashSelectors,
  });

  const drawingsController = createDrawingsController(ctx, {
    canUseDrawings: () => canUseDrawings(),
    getGeometryItemsMap,
    downloadTextFile,
    applySearchHighlight,
    fitToItems,
    setModelSelection,
  });
  const {
    toggleDrawingsPanel,
    generateDrawing,
    annotateActiveDrawing,
    clearActiveDrawingAnnotations,
    createSheetFromActiveDrawing,
    exportActiveSheetSvg,
    exportActiveSheetPng,
    exportActiveSheetPdf,
    exportActiveSheetDxf,
    placeSpecificationsOnActiveSheet,
    exportSpecifications,
    syncDrawingSelectionFromModel,
  } = drawingsController;
  controllerRegistry.register("drawings", {
    close: drawingsController.closeDrawingsPanel,
    render: drawingsController.renderDrawingsPanel,
    reset: drawingsController.clearDrawings,
    persist: drawingsController.persistDrawings,
  });

  const modelController = createModelController({
    ctx,
    clearSearch,
    clearDrawings: () => clearDrawings(),
    renderIssues: () => renderIssues(),
    renderClash: () => renderClash(),
    applyDataFilters: () => applyDataFilters(),
    refreshClashSelectors: () => refreshClashSelectors(),
    clearBBoxIndex: () => clearBBoxIndex(),
    resetDataIndex: () => resetDataIndex(),
    resetChecks: () => resetChecks(),
    setActiveShareRecord,
    closeLibraryModal: () => closeLibraryModal(),
    refreshFederationRegistry,
    persistFederationRegistry,
    setLoadReportDraft: (draft) => {
      pendingLoadReportDraft = draft;
    },
  });
  const {
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
    closeFederationPanel: closeFederationPanelAction,
  } = modelController;

  const profileRouter = createProfileRouter({
    ctx,
    closeDataPanel: () => closeDataPanel(),
    closeChecksPanel: () => closeChecksPanel(),
    closeIssuesPanel: () => closeIssuesPanel(),
    closeClashPanel: () => closeClashPanel(),
    closeDrawingsPanel: () => closeDrawingsPanel(),
    refreshModelState,
    onProfileChange: (profile) => {
      if (profile === "km") {
        stripKmProfileChrome(profile, {
          profileScreen: ctx.dom.profileScreen,
          bimStub: ctx.dom.bimStub,
        });
      }

      if (profile === "bim") {
        checksController.loadChecksSettings(profile);
      }
    },
  });
  const {
    navigateToProfile,
    syncProfileWithLocation,
    selectProfile,
  } = profileRouter;
  canUseDataBrowser = profileRouter.canUseDataBrowser;
  canUseDrawings = profileRouter.canUseDrawings;
  canUseChecks = profileRouter.canUseChecks;
  canUseIssues = profileRouter.canUseIssues;
  canUseCoordination = profileRouter.canUseCoordination;

  const libraryController = createLibraryController({
    ctx,
    loadIfc,
    loadFragBuffer,
    selectProfile,
    setActiveShareRecord,
  });
  const {
    openLibraryModal,
    showLibraryStart,
    renderExampleList,
    showFragmentLibrary,
    openFragmentFromUrl,
    saveCurrentFragment,
    fetchExampleBlob,
  } = libraryController;
  controllerRegistry.register("library", {
    close: libraryController.closeLibraryModal,
  });

  async function findSelectedInData() {
    if (isEmptySelection(workspace.viewer.activeSelection)) {
      ctx.showToast("Сначала выберите элемент", "error");
      return;
    }

    if (workspace.data.elementIndex.length === 0) await rebuildDataIndex();
    openDataPanel();
    const record = findRecordInSelection();
    if (!record) {
      ctx.showToast("Выбранный элемент не найден в BIM Data Index", "error");
      return;
    }

    await selectDataRecord(record);
    ctx.setStatus(`Найдено в данных: ${record.modelId}:${record.localId}`);
  }

  async function addActiveSelectionToSelectionSet() {
    if (isEmptySelection(workspace.viewer.activeSelection)) {
      ctx.showToast("Сначала выберите элемент", "error");
      return;
    }

    workspace.viewer.selectionSet = mergeModelIdMaps(
      workspace.viewer.selectionSet,
      workspace.viewer.activeSelection,
    );
    await applySearchHighlight(workspace.viewer.selectionSet);
    await setModelSelection(workspace.viewer.selectionSet);
    const total = countSelection(workspace.viewer.selectionSet);
    ctx.setStatus(`В выборке: ${total}`);
    ctx.showToast(`Добавлено в выборку · всего ${total}`, "success");
  }

  createElementContextMenu({
    target: viewport,
    getSelectionCount: () => countSelection(workspace.viewer.activeSelection),
    onOpenProperties: openPropertiesPanel,
    onFindInData: () => void findSelectedInData(),
    onCreateIssue: () => void createIssueFromSelection(),
    onAddToSelectionSet: () => void addActiveSelectionToSelectionSet(),
    onMissingSelection: () => ctx.showToast("Сначала выберите элемент", "error"),
  });

  const fragmentId = new URLSearchParams(window.location.search).get("fragment")?.trim();
  const restoreFederationWorkspace = createFederationWorkspaceRestorer({
    ctx,
    storedFederationWorkspace,
    fragmentId,
    apiBase: API_BASE,
    fetchExampleBlob,
    loadIfc,
    loadFragBuffer,
    refreshFederationRegistry,
  });

  bindBimUiEvents(ctx, drawingInteraction, {
    search: {
      searchItems,
      toggleSearchPanel,
      expandSearchPanel,
      closeSearchPanel,
    },
    data: {
      toggleDataPanel,
      closeDataPanel,
      applyDataFilters,
      highlightFilteredElements,
      exportElementsCsv,
      exportElementsJson,
      exportIfcFile,
    },
    checks: {
      toggleChecksPanel,
      closeChecksPanel,
      loadIDSFile,
      addIDSRequirementFromForm,
      saveIDSFile,
      runChecks,
      exportChecksCsv,
      exportChecksJson,
    },
    issues: {
      toggleIssuesPanel,
      closeIssuesPanel,
      createIssueFromSelection,
      renderIssues,
      exportIssuesJson,
      exportIssuesBcfLikeJson,
    },
    clash: {
      toggleClashPanel,
      closeClashPanel,
      runClashDetection,
      clearBBoxIndex,
      renderClash,
    },
    federation: {
      togglePanel: toggleFederationPanel,
      closePanel: closeFederationPanelAction,
    },
    drawings: {
      toggleDrawingsPanel,
      closeDrawingsPanel,
      generateDrawing,
      annotateActiveDrawing,
      clearActiveDrawingAnnotations,
      createSheetFromActiveDrawing,
      placeSpecificationsOnActiveSheet,
      exportActiveSheetSvg,
      exportActiveSheetPng,
      exportActiveSheetPdf,
      exportActiveSheetDxf,
      exportSpecifications,
      clearDrawings,
    },
    help: {
      openHelpPage,
      closeHelpPage,
    },
    model: {
      loadIfc,
      loadFrag,
      clearModels,
      downloadFragments,
      hideSelected,
      isolateSelected,
      fitToModels,
      resetHomeView,
    },
    profile: {
      navigateToProfile,
    },
    library: {
      openLibraryModal,
      showLibraryStart,
      showFragmentLibrary,
      closeLibraryModal,
      openFragmentFromUrl,
      saveCurrentFragment,
    },
    share: {
      openShareModal,
      closeShareModal,
      copyShareLink,
    },
    utilities: {
      cancelActiveOperation: appStatus.cancelActiveOperation,
      clearSelectionInfo,
    },
  });

  world.camera.controls.addEventListener("update", () => {
    fragments.core.update();
  });

  world.onCameraChanged.add((camera) => {
    for (const [, model] of fragments.list) {
      model.useCamera(camera.three);
    }
    fragments.core.update(true);
  });

  fragments.core.onModelLoaded.add((model) => {
    model.useCamera(world.camera.three);
    world.scene.three.add(model.object);
    refreshModelState();
    void (async () => {
      const loadReportDraft = pendingLoadReportDraft;
      const fragmentBufferPromise = loadReportDraft ? model.getBuffer(true).catch(() => null) : Promise.resolve(null);
      const sceneBuildStartedAt = performance.now();
      await fragments.core.update(true);
      await fitToModels();
      // Data indexing is triggered on demand by Data/Checks/Clash panels.
      // Avoid blocking the first visible model load when ThatOpen item-data reads stall on some IFCs/mobile browsers.
      if (!loadReportDraft) return;

      const fragmentBuffer = await fragmentBufferPromise;
      const report = createModelLoadReport({
        sourceName: loadReportDraft.sourceName,
        ifcSizeBytes: loadReportDraft.ifcSizeBytes,
        fragmentSizeBytes: loadReportDraft.fragmentSizeBytes ?? fragmentBuffer?.byteLength ?? 0,
        conversionTimeMs: loadReportDraft.conversionTimeMs,
        sceneBuildTimeMs: performance.now() - sceneBuildStartedAt,
      });
      pendingLoadReportDraft = null;
      openLoadReportModal(report);
    })();
  });

  fragments.list.onItemDeleted.add(() => {
    refreshModelState();
    clearSelectionInfo();
    void clearSearch();
  });

  fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
    if (!("isLodMaterial" in material && material.isLodMaterial)) {
      material.polygonOffset = true;
      material.polygonOffsetUnits = 1;
      material.polygonOffsetFactor = Math.random();
    }
  });

  highlighter.events.select.onHighlight.add(async (modelIdMap) => {
    workspace.viewer.activeSelection = modelIdMap;
    selectionCount.textContent = String(countSelection(modelIdMap));
    await renderSelectedProperties({
      components,
      modelIdMap,
      output: propertiesOutput,
      overrideState: workspace.ifcOverrides,
      onSaveOverride: savePropertyOverride,
      onRemoveOverride: removeOverride,
      onClearOverrides: clearOverrides,
    });
    syncDataTableSelectionFromModel(modelIdMap);
    syncDrawingSelectionFromModel(modelIdMap);
  });

  highlighter.events.select.onClear.add(() => {
    clearSelectionInfo();
    syncDataTableSelectionFromModel({});
  });

  syncProfileWithLocation();
  resetDataIndex();
  renderExampleList();
  refreshModelState();
  void restoreFederationWorkspace();
  void openFragmentFromUrl();

  function downloadTextFile(name: string, content: string, type: string) {
    const file = new File([content], name, { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function clearSelectionInfo() {
    workspace.viewer.activeSelection = {};
    workspace.viewer.selectionSet = {};
    selectionCount.textContent = "0";
    closePropertiesPanel();
    propertiesOutput.replaceChildren(createMessage("Выберите элемент модели."));
  }

  function findRecordInSelection() {
    for (const record of workspace.data.elementIndex) {
      if (workspace.viewer.activeSelection[record.modelId]?.has(record.localId)) return record;
    }
    return null;
  }

  async function setModelSelection(modelIdMap: ModelIdMap) {
    workspace.viewer.activeSelection = modelIdMap;
    selectionCount.textContent = String(countSelection(modelIdMap));
    await renderSelectedProperties({
      components,
      modelIdMap,
      output: propertiesOutput,
      overrideState: workspace.ifcOverrides,
      onSaveOverride: savePropertyOverride,
      onRemoveOverride: removeOverride,
      onClearOverrides: clearOverrides,
    });
    syncDataTableSelectionFromModel(modelIdMap);
  }


}
