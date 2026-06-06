import workerUrl from "@thatopen/fragments/worker?url";
import "../styles.css";
import { APP_BASE } from "./config";
import { getDomElements } from "./dom";
import { renderSelectedProperties } from "./properties/properties-panel";
import { countSelection } from "./selection/selection";
import { createWorkspaceState } from "./state/workspace-state";
import { createDrawingInteractionController } from "./drawings/drawing-interaction";
import { syncDrawingAnnotations, type DrawingAnnotationType } from "./drawings/drawing-annotations";
import { createIssueStore } from "./issues/issues-store";
import { getProfileCapabilities } from "./profiles";
import { createMessage } from "./ui/dom-utils";
import { createBimViewer } from "./viewer/viewer";
import { mountSpatialTree } from "./tree/spatial-tree";
import type { BimAppContext } from "./app/app-context";
import { createProfileRouter } from "./app/profile-router";
import { createModelController } from "./app/model-controller";
import { createShareController } from "./app/share-controller";
import { createLibraryController } from "./app/library-controller";
import { createSearchController } from "./app/search-controller";
import { createDataController } from "./app/data-controller";
import { createChecksController } from "./app/checks-controller";
import { createIssuesController } from "./app/issues-controller";
import { createClashController } from "./app/clash-controller";
import { createDrawingsController } from "./app/drawings-controller";

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
    fileName,
    modelCount,
    selectionCount,
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

  const { components, world, fragments, ifcLoader, highlighter, hider } = await createBimViewer({
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
  const issueStore = createIssueStore();
  const ctx: BimAppContext = {
    dom: getDomElements(),
    viewer: { components, world, fragments, ifcLoader, highlighter, hider },
    workspace,
    issueStore,
    getCapabilities: () => getProfileCapabilities(workspace.activeProfile),
    setStatus: (message) => {
      statusText.textContent = message;
    },
    setBusy,
    setProgress,
    showError,
  };
  void ctx;
  const drawingInteraction = createDrawingInteractionController({
    viewport,
    world,
    components,
    getActiveDrawing: () => workspace.drawings[0] ?? null,
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

  let closeLibraryModal = () => {};
  let canUseDataBrowser = () => false;
  let canUseDrawings = () => false;
  let canUseChecks = () => false;
  let canUseIssues = () => false;
  let canUseCoordination = () => false;

  let closeDataPanel = () => {};
  let closeChecksPanel = () => {};
  let closeIssuesPanel = () => {};
  let closeClashPanel = () => {};
  let closeDrawingsPanel = () => {};
  let refreshClashSelectors = () => {};
  let renderClash = () => {};
  let clearBBoxIndex = () => {};
  let renderIssues = () => {};
  let clearDrawings = () => {};
  let resetDataIndex = () => {};
  let resetChecks = () => {};
  let persistDrawings: () => unknown = () => null;
  let renderDrawingsPanel = () => {};

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
    refreshClashSelectors: () => refreshClashSelectors(),
  });
  const {
    toggleDataPanel,
    openDataPanel,
    applyDataFilters,
    rebuildDataIndex,
    selectDataRecord,
    highlightFilteredElements,
    exportElementsCsv,
    exportElementsJson,
  } = dataController;
  closeDataPanel = dataController.closeDataPanel;
  resetDataIndex = dataController.resetDataIndex;

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
  closeIssuesPanel = issuesController.closeIssuesPanel;
  renderIssues = issuesController.renderIssues;

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
  closeChecksPanel = checksController.closeChecksPanel;
  resetChecks = checksController.resetChecks;

  const clashController = createClashController(ctx, {
    canUseCoordination: () => canUseCoordination(),
    rebuildDataIndex,
    applySearchHighlight,
    fitToItems,
    renderIssues: () => renderIssues(),
    captureCamera,
  });
  const { toggleClashPanel, runClashDetection } = clashController;
  closeClashPanel = clashController.closeClashPanel;
  refreshClashSelectors = clashController.refreshClashSelectors;
  renderClash = clashController.renderClash;
  clearBBoxIndex = clashController.clearBBoxIndex;

  const drawingsController = createDrawingsController(ctx, {
    canUseDrawings: () => canUseDrawings(),
    getGeometryItemsMap,
    downloadTextFile,
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
    exportSpecifications,
  } = drawingsController;
  closeDrawingsPanel = drawingsController.closeDrawingsPanel;
  clearDrawings = drawingsController.clearDrawings;
  persistDrawings = drawingsController.persistDrawings;
  renderDrawingsPanel = drawingsController.renderDrawingsPanel;

  const modelController = createModelController({
    ctx,
    clearSearch,
    clearDrawings: () => clearDrawings(),
    renderIssues: () => renderIssues(),
    renderClash: () => renderClash(),
    clearBBoxIndex: () => clearBBoxIndex(),
    resetDataIndex: () => resetDataIndex(),
    resetChecks: () => resetChecks(),
    setActiveShareRecord,
    closeLibraryModal: () => closeLibraryModal(),
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
  } = modelController;

  const profileRouter = createProfileRouter({
    ctx,
    closeDataPanel: () => closeDataPanel(),
    closeChecksPanel: () => closeChecksPanel(),
    closeIssuesPanel: () => closeIssuesPanel(),
    closeClashPanel: () => closeClashPanel(),
    closeDrawingsPanel: () => closeDrawingsPanel(),
    refreshModelState,
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
  } = libraryController;
  closeLibraryModal = libraryController.closeLibraryModal;

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
      await fragments.core.update(true);
      await fitToModels();
      if (canUseDataBrowser()) await rebuildDataIndex();
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
    workspace.activeSelection = modelIdMap;
    selectionCount.textContent = String(countSelection(modelIdMap));
    await renderSelectedProperties({ components, modelIdMap, output: propertiesOutput });
  });

  highlighter.events.select.onClear.add(() => {
    clearSelectionInfo();
  });

  loadIfcBtn.onclick = () => openLibraryModal();
  loadFragBtn.onclick = () => fragInput.click();
  fitBtn.onclick = () => void fitToModels();
  clearBtn.onclick = () => void clearModels();
  downloadFragBtn.onclick = () => void downloadFragments();
  hideSelectedBtn.onclick = () => void hideSelected();
  isolateSelectedBtn.onclick = () => void isolateSelected();
  showAllBtn.onclick = () => void hider.set(true);
  searchToggleBtn.onclick = () => toggleSearchPanel();
  homeViewBtn.onclick = () => void resetHomeView();
  dataBrowserBtn.onclick = () => toggleDataPanel();
  checksBtn.onclick = () => toggleChecksPanel();
  issuesBtn.onclick = () => toggleIssuesPanel();
  clashBtn.onclick = () => toggleClashPanel();
  drawingsBtn.onclick = () => toggleDrawingsPanel();
  closeDataPanelBtn.onclick = () => closeDataPanel();
  dataSearchInput.oninput = () => applyDataFilters();
  dataCategoryFilter.onchange = () => applyDataFilters();
  dataStoreyFilter.onchange = () => applyDataFilters();
  highlightFilteredBtn.onclick = () => void highlightFilteredElements();
  exportCsvBtn.onclick = () => exportElementsCsv(workspace.filteredElements);
  exportJsonBtn.onclick = () => exportElementsJson(workspace.filteredElements);
  closeChecksPanelBtn.onclick = () => closeChecksPanel();
  idsFileInput.onchange = () => void loadIDSFile();
  addIdsRequirementBtn.onclick = () => addIDSRequirementFromForm();
  saveIdsBtn.onclick = () => saveIDSFile();
  runChecksBtn.onclick = () => void runChecks();
  exportChecksCsvBtn.onclick = () => exportChecksCsv(workspace.healthReport);
  exportChecksJsonBtn.onclick = () => exportChecksJson(workspace.healthReport);
  closeIssuesPanelBtn.onclick = () => closeIssuesPanel();
  createIssueBtn.onclick = () => void createIssueFromSelection();
  exportIssuesJsonBtn.onclick = () => exportIssuesJson(issueStore.list());
  exportIssuesBcfBtn.onclick = () => exportIssuesBcfLikeJson(issueStore.list());
  clearIssuesBtn.onclick = () => {
    issueStore.clear();
    renderIssues();
  };
  closeClashPanelBtn.onclick = () => closeClashPanel();
  runClashBtn.onclick = () => void runClashDetection();
  clearClashBtn.onclick = () => {
    workspace.clashes = [];
    renderClash();
  };
  closeDrawingsPanelBtn.onclick = () => closeDrawingsPanel();
  generateDrawingBtn.onclick = () => void generateDrawing();
  addAnnotationBtn.onclick = () => void annotateActiveDrawing();
  interactiveAnnotationBtn.onclick = () => {
    drawingInteraction.setActive(!drawingInteraction.active);
    interactiveAnnotationBtn.classList.toggle("is-active", drawingInteraction.active);
  };
  clearAnnotationsBtn.onclick = () => clearActiveDrawingAnnotations();
  createSheetBtn.onclick = () => createSheetFromActiveDrawing();
  exportSheetSvgBtn.onclick = () => exportActiveSheetSvg();
  exportSheetPngBtn.onclick = () => void exportActiveSheetPng();
  exportSheetPdfBtn.onclick = () => exportActiveSheetPdf();
  exportSheetDxfBtn.onclick = () => exportActiveSheetDxf();
  exportSpecsBtn.onclick = () => exportSpecifications();
  clearDrawingsBtn.onclick = () => clearDrawings();
  searchBtn.onclick = () => void searchItems();
  clearSearchBtn.onclick = () => void closeSearchPanel();
  searchPanel.onclick = () => {
    if (searchPanel.classList.contains("is-collapsed")) expandSearchPanel();
  };
  profileKmBtn.onclick = () => navigateToProfile("km");
  profileBimBtn.onclick = () => navigateToProfile("bim");
  backToProfilesBtn.onclick = () => navigateToProfile("pending");
  closeLibraryBtn.onclick = () => closeLibraryModal();
  chooseFragmentBtn.onclick = () => void showFragmentLibrary();
  addIfcBtn.onclick = () => ifcInput.click();
  libraryBackBtn.onclick = () => showLibraryStart();
  saveFragmentBtn.onclick = () => void saveCurrentFragment();
  shareModelBtn.onclick = () => openShareModal();
  closeShareBtn.onclick = () => closeShareModal();
  copyShareBtn.onclick = () => void copyShareLink();
  topBackBtn.onclick = () => navigateToProfile("pending");

  ifcInput.onchange = () => {
    const [file] = ifcInput.files ?? [];
    if (file) void loadIfc(file);
    ifcInput.value = "";
  };

  fragInput.onchange = () => {
    const [file] = fragInput.files ?? [];
    if (file) void loadFrag(file);
    fragInput.value = "";
  };

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      closeShareModal();
      void highlighter.clear("select");
      void highlighter.clear("search");
    }

    if (event.code === "Enter" && document.activeElement === searchInput) {
      void searchItems();
    }
  });

  syncProfileWithLocation();
  resetDataIndex();
  renderExampleList();
  refreshModelState();
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
    workspace.activeSelection = {};
    selectionCount.textContent = "0";
    propertiesOutput.replaceChildren(createMessage("Выберите элемент модели."));
  }

  function setBusy(isBusy: boolean, message?: string) {
    loadIfcBtn.loading = isBusy;
    loadFragBtn.loading = isBusy;
    loadingOverlay.hidden = !isBusy;
    progress.hidden = !isBusy;
    if (isBusy) setProgress(0);
    if (message) {
      statusText.textContent = message;
      loadingStatus.textContent = message;
    }
  }

  function setProgress(value: number) {
    const percentage = Math.max(0, Math.min(100, value * 100));
    progressBar.style.width = `${percentage}%`;
    loadingStatus.textContent = `${statusText.textContent || "Обработка модели"} · ${Math.round(percentage)}%`;
  }

  function showError(error: unknown) {
    console.error(error);
    statusText.textContent = "Ошибка загрузки модели";
    propertiesOutput.replaceChildren(
      createMessage(error instanceof Error ? error.message : String(error)),
    );
  }


}
