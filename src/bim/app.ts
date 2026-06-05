import * as THREE from "three";
import workerUrl from "@thatopen/fragments/worker?url";
import "../styles.css";
import { APP_BASE } from "./config";
import { getDomElements } from "./dom";
import { renderSelectedProperties } from "./properties/properties-panel";
import { countSelection, isEmptySelection, subtractModelIdMap } from "./selection/selection";
import type { ModelIdMap } from "./types";
import { createWorkspaceState } from "./state/workspace-state";
import {
  buildElementIndex,
  filterElementIndex,
  getUniqueValues,
  recordsToModelIdMap,
  type BimElementRecord,
} from "./data/element-index";
import type { HealthCheckIssue } from "./checks/check-types";
import {
  exportElementsCsv,
  exportElementsJson,
  fillSelectOptions,
  renderElementTable,
} from "./data/data-browser";
import {
  createTechnicalDrawing,
  disposeDrawing,
  downloadDrawingDxf,
  fitCameraToDrawing,
  renderDrawingList,
  type DrawingRecord,
  type DrawingSource,
  type DrawingView,
} from "./drawings/drawings-panel";
import {
  addDrawingAnnotation,
  clearDrawingAnnotations,
  getDrawingAnnotationTypeLabel,
  syncDrawingAnnotations,
  type DrawingAnnotationType,
} from "./drawings/drawing-annotations";
import { createDrawingInteractionController } from "./drawings/drawing-interaction";
import {
  clearStoredDrawingWorkspace,
  loadStoredDrawingWorkspace,
  replayStoredAnnotations,
  saveDrawingWorkspace,
  type StoredDrawingWorkspace,
} from "./drawings/drawing-persistence";
import { createSheet } from "./sheets/sheet-board";
import { downloadSheetPng, downloadSheetSvg, openSheetPdfPrint } from "./sheets/pdf-export";
import { downloadSheetDxfPaperSpace } from "./sheets/dxf-paper-export";
import type { SheetFormat } from "./sheets/sheet-types";
import { generateSpecification, specificationToCsv } from "./specs/spec-generator";
import {
  exportChecksCsv,
  exportChecksJson,
  formatChecksSummary,
  renderChecksPanel,
} from "./ui/checks-panel";
import {
  addIDSPropertyRequirement,
  exportIDSSpecifications,
  getIDSTitle,
  getLoadedIDSSpecificationCount,
  loadIDSSpecifications,
  runIDSValidation,
  runModelHealthChecks,
} from "./checks/model-health";
import { createIssueStore } from "./issues/issues-store";
import type { BimIssue, BimIssueStatus } from "./issues/issue-types";
import { exportIssuesBcfLikeJson, exportIssuesJson } from "./issues/bcf-export";
import { renderIssuesPanel } from "./ui/issues-panel";
import { detectHardClashes } from "./clash/clash-detector";
import type { ClashRecord } from "./clash/clash-types";
import { getClashGroupOptions, selectClashGroup, summarizeFederatedModels } from "./federation/federation";
import { fillClashGroupSelect, renderClashPanel } from "./ui/clash-panel";
import { getProfileCapabilities } from "./profiles";
import { createMessage, escapeHtml, getAttrText } from "./ui/dom-utils";
import { createBimViewer, dimHighlightStyle, searchHighlightStyle } from "./viewer/viewer";
import { mountSpatialTree } from "./tree/spatial-tree";
import type { BimAppContext } from "./app/app-context";
import { createProfileRouter } from "./app/profile-router";
import { createModelController } from "./app/model-controller";
import { createShareController } from "./app/share-controller";
import { createLibraryController } from "./app/library-controller";
import { createSearchController } from "./app/search-controller";

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

  const modelController = createModelController({
    ctx,
    clearSearch,
    clearDrawings,
    renderIssues,
    renderClash,
    resetDataIndex,
    resetChecks,
    setActiveShareRecord,
    closeLibraryModal,
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
    closeDataPanel,
    closeChecksPanel,
    closeIssuesPanel,
    closeClashPanel,
    closeDrawingsPanel,
    refreshModelState,
  });
  const {
    navigateToProfile,
    syncProfileWithLocation,
    selectProfile,
    canUseDataBrowser,
    canUseDrawings,
    canUseChecks,
    canUseIssues,
    canUseCoordination,
  } = profileRouter;


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

  function toggleDataPanel() {
    if (dataPanel.hidden) {
      openDataPanel();
      return;
    }

    closeDataPanel();
  }

  function openDataPanel() {
    if (!canUseDataBrowser()) {
      dataPanel.hidden = true;
      statusText.textContent = "BIM Data Browser доступен только в профиле BIM";
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

  function toggleChecksPanel() {
    if (checksPanel.hidden) {
      openChecksPanel();
      return;
    }

    closeChecksPanel();
  }

  function openChecksPanel() {
    if (!canUseChecks()) {
      checksPanel.hidden = true;
      statusText.textContent = "Model Health Checks доступны только в профиле BIM";
      return;
    }

    checksPanel.hidden = false;
    renderChecksPanel({
      report: workspace.healthReport,
      output: checksOutput,
      onSelect: selectDataRecord,
      onCreateIssue: createIssueFromHealthCheck,
    });
    checksSummary.textContent = formatChecksSummary(workspace.healthReport);
  }

  function closeChecksPanel() {
    checksPanel.hidden = true;
  }

  async function loadIDSFile() {
    const file = idsFileInput.files?.[0];
    if (!file) return;
    try {
      const xml = await file.text();
      const specs = loadIDSSpecifications(components, xml);
      const loadedTitle = getIDSTitle(components);
      if (loadedTitle) idsTitleInput.value = loadedTitle;
      workspace.healthReport = null;
      checksSummary.textContent = `IDS загружен: ${specs.length} specs`;
      checksOutput.replaceChildren(createMessage(`Файл ${file.name}. Запустите проверку по IDS.`));
    } catch (error) {
      console.error(error);
      checksSummary.textContent = "Ошибка IDS";
      checksOutput.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
    }
  }

  function addIDSRequirementFromForm() {
    const title = idsTitleInput.value.trim() || "BIM IDS";
    const specificationName = idsSpecNameInput.value.trim();
    const entity = idsEntityInput.value.trim();
    const propertySet = idsPsetInput.value.trim();
    const propertyName = idsPropertyInput.value.trim();

    if (!(specificationName && entity && propertySet && propertyName)) {
      checksSummary.textContent = "Заполните spec, entity, pset и property";
      return;
    }

    const spec = addIDSPropertyRequirement(components, {
      title,
      specificationName,
      entity,
      propertySet,
      propertyName,
    });
    workspace.healthReport = null;
    checksSummary.textContent = `IDS spec добавлен: ${spec.name}`;
    checksOutput.replaceChildren(
      createMessage(`Всего IDS specs: ${getLoadedIDSSpecificationCount(components)}. Можно сохранить IDS или проверить модель.`),
    );
  }

  function saveIDSFile() {
    if (getLoadedIDSSpecificationCount(components) === 0) {
      checksSummary.textContent = "Нет IDS specs для сохранения";
      return;
    }

    const xml = exportIDSSpecifications(components, idsTitleInput.value);
    downloadTextFile("bim-requirements.ids", xml, "application/xml");
    checksSummary.textContent = `IDS сохранён: ${getLoadedIDSSpecificationCount(components)} specs`;
  }

  async function runChecks() {
    if (!canUseChecks()) return;
    if (fragments.list.size === 0) return;

    runChecksBtn.loading = true;
    try {
      checksPanel.hidden = false;
      if (workspace.elementIndex.length === 0) {
        checksSummary.textContent = "Сначала индексируем элементы...";
        await rebuildDataIndex();
      }
      workspace.healthReport = runModelHealthChecks(workspace.elementIndex);
      checksSummary.textContent = formatChecksSummary(workspace.healthReport);
      renderChecksPanel({
        report: workspace.healthReport,
        output: checksOutput,
        onSelect: selectDataRecord,
        onCreateIssue: createIssueFromHealthCheck,
      });
      statusText.textContent = `Model Health: ${workspace.healthReport.summary.issueCount} проблем`;
    } catch (error) {
      console.error(error);
      checksSummary.textContent = "Ошибка проверки";
      checksOutput.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      runChecksBtn.loading = false;
    }
  }

  function resetChecks() {
    workspace.healthReport = null;
    checksSummary.textContent = "Проверка не выполнена";
    checksOutput.replaceChildren(createMessage("Загрузите модель и запустите проверку."));
  }

  async function rebuildDataIndex() {
    if (!canUseDataBrowser()) {
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
      refreshClashSelectors();
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
    refreshClashSelectors();
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
    await applySearchHighlight(modelIdMap);
    await fitToItems(modelIdMap);
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
      await applySearchHighlight(modelIdMap);
      await fitToItems(modelIdMap);
      statusText.textContent = `Подсвечено элементов: ${limitedRecords.length}`;
    } finally {
      highlightFilteredBtn.loading = false;
    }
  }

  function toggleIssuesPanel() {
    if (issuesPanel.hidden) {
      openIssuesPanel();
      return;
    }
    closeIssuesPanel();
  }

  function openIssuesPanel() {
    if (!canUseIssues()) {
      issuesPanel.hidden = true;
      statusText.textContent = "Issues / BCF доступны только в профиле BIM";
      return;
    }

    issuesPanel.hidden = false;
    renderIssues();
  }

  function closeIssuesPanel() {
    issuesPanel.hidden = true;
  }

  function renderIssues() {
    renderIssuesPanel({
      issues: issueStore.list(),
      output: issuesOutput,
      summary: issuesSummary,
      onSelect: selectIssue,
      onStatusChange: (issue, status) => {
        issueStore.updateStatus(issue.id, status);
        renderIssues();
      },
      onDelete: (issue) => {
        issueStore.remove(issue.id);
        renderIssues();
      },
    });
  }

  async function createIssueFromSelection() {
    if (!canUseIssues()) return;
    if (isEmptySelection(workspace.activeSelection)) {
      issuesSummary.textContent = "Сначала выберите элемент";
      return;
    }

    if (workspace.elementIndex.length === 0) await rebuildDataIndex();
    const record = findRecordInSelection();
    if (!record) {
      issuesSummary.textContent = "Выбранный элемент не найден в BIM Data Index";
      return;
    }

    const issue = issueStore.create({
      title: `Замечание: ${record.name || record.category}`,
      description: `${record.category} #${record.localId}`,
      priority: "medium",
      source: "manual",
      record,
      camera: captureCamera(),
    });
    issuesPanel.hidden = false;
    renderIssues();
    statusText.textContent = `Issue создан: ${issue.title}`;
  }

  function createIssueFromHealthCheck(healthIssue: HealthCheckIssue) {
    const priority = healthIssue.severity === "critical" ? "critical" : healthIssue.severity === "warning" ? "medium" : "low";
    const issue = issueStore.create({
      title: healthIssue.title,
      description: healthIssue.description,
      priority,
      source: "health-check",
      record: healthIssue.record,
      camera: captureCamera(),
    });
    issuesPanel.hidden = false;
    renderIssues();
    statusText.textContent = `Issue создан из проверки: ${issue.title}`;
  }

  async function selectIssue(issue: BimIssue) {
    const record = workspace.elementIndex.find((item) => item.modelId === issue.modelId && item.localId === issue.localId) ?? {
      modelId: issue.modelId,
      localId: issue.localId,
      name: issue.elementName,
      category: issue.ifcClass,
      globalId: issue.globalId,
      typeName: "",
      storey: "",
      number: "",
      materialName: "",
      psetCount: 0,
      searchable: "",
    };
    await selectDataRecord(record);
  }

  function toggleClashPanel() {
    if (clashPanel.hidden) {
      openClashPanel();
      return;
    }
    closeClashPanel();
  }

  function openClashPanel() {
    if (!canUseCoordination()) {
      clashPanel.hidden = true;
      statusText.textContent = "Federation / Clash доступны только в профиле BIM";
      return;
    }

    clashPanel.hidden = false;
    if (workspace.elementIndex.length === 0 && fragments.list.size > 0) {
      void rebuildDataIndex().then(() => renderClash());
      return;
    }
    refreshClashSelectors();
    renderClash();
  }

  function closeClashPanel() {
    clashPanel.hidden = true;
  }

  function refreshClashSelectors() {
    const models = summarizeFederatedModels(workspace.elementIndex);
    const groups = getClashGroupOptions(workspace.elementIndex);
    fillClashGroupSelect(clashGroupASelect, { models, ...groups });
    fillClashGroupSelect(clashGroupBSelect, { models, ...groups });
  }

  function renderClash() {
    renderClashPanel({
      models: summarizeFederatedModels(workspace.elementIndex),
      clashes: workspace.clashes,
      output: clashOutput,
      summary: clashSummary,
      onSelect: (clash) => void selectClash(clash),
      onCreateIssue: createIssueFromClash,
    });
  }

  async function runClashDetection() {
    if (!canUseCoordination()) return;
    if (fragments.list.size === 0) return;

    runClashBtn.loading = true;
    try {
      clashPanel.hidden = false;
      if (workspace.elementIndex.length === 0) {
        clashSummary.textContent = "Сначала индексируем элементы...";
        await rebuildDataIndex();
      }

      const groupA = selectClashGroup(workspace.elementIndex, clashGroupASelect.value);
      const groupB = selectClashGroup(workspace.elementIndex, clashGroupBSelect.value);
      const tolerance = Math.max(0, Number(clashToleranceInput.value) || 0);
      clashSummary.textContent = `Проверка пар: ${Math.min(groupA.length, 250)} × ${Math.min(groupB.length, 250)}`;

      const result = await detectHardClashes(fragments, {
        groupA,
        groupB,
        tolerance,
        limit: 250,
      });
      workspace.clashes = result.clashes;
      renderClash();
      statusText.textContent = `Clash detection: ${result.clashes.length} найдено, ${result.checkedPairs} пар`;
    } catch (error) {
      console.error(error);
      clashSummary.textContent = "Ошибка clash detection";
      clashOutput.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      runClashBtn.loading = false;
    }
  }

  async function selectClash(clash: ClashRecord) {
    await applySearchHighlight(clash.modelIdMap);
    await fitToItems(clash.modelIdMap);
    workspace.activeSelection = clash.modelIdMap;
    selectionCount.textContent = String(countSelection(clash.modelIdMap));
  }

  function createIssueFromClash(clash: ClashRecord) {
    const issue = issueStore.create({
      title: `Clash: ${clash.title}`,
      description: clash.description,
      priority: clash.severity === "critical" ? "critical" : clash.severity === "warning" ? "high" : "medium",
      source: "manual",
      record: clash.a,
      camera: captureCamera(),
    });
    issuesPanel.hidden = false;
    renderIssues();
    statusText.textContent = `Issue создан из clash: ${issue.title}`;
  }

  function findRecordInSelection() {
    for (const record of workspace.elementIndex) {
      if (workspace.activeSelection[record.modelId]?.has(record.localId)) return record;
    }
    return null;
  }

  function captureCamera() {
    const position = world.camera.three.position;
    const target = world.camera.controls.getTarget(new THREE.Vector3());
    return {
      position: [position.x, position.y, position.z] as [number, number, number],
      target: [target.x, target.y, target.z] as [number, number, number],
    };
  }

  function toggleDrawingsPanel() {
    if (drawingsPanel.hidden) {
      openDrawingsPanel();
      return;
    }
    closeDrawingsPanel();
  }

  function openDrawingsPanel() {
    if (!canUseDrawings()) {
      drawingsPanel.hidden = true;
      statusText.textContent = "Drawings / DXF доступны только в профиле BIM";
      return;
    }

    drawingsPanel.hidden = false;
    renderDrawingsPanel();
  }

  function closeDrawingsPanel() {
    drawingsPanel.hidden = true;
  }

  async function generateDrawing() {
    if (!canUseDrawings()) return;
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

      workspace.drawings.unshift(record);
      persistDrawings();
      renderDrawingsPanel();
      await fitCameraToDrawing(world, record);
      statusText.textContent = `Чертёж готов: ${record.lineCount} линий`;
    } catch (error) {
      console.error(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      generateDrawingBtn.loading = false;
    }
  }

  async function getDrawingSourceMap(source: DrawingSource) {
    if (source === "selection") {
      if (isEmptySelection(workspace.activeSelection)) throw new Error("Нет текущей выборки");
      return workspace.activeSelection;
    }

    if (source === "filtered") {
      if (workspace.filteredElements.length === 0) throw new Error("Нет элементов в фильтре Data Browser");
      return recordsToModelIdMap(workspace.filteredElements);
    }

    return getGeometryItemsMap();
  }

  function renderDrawingsPanel() {
    const totalLines = workspace.drawings.reduce((sum, record) => sum + record.lineCount, 0);
    const totalAnnotations = workspace.drawings.reduce((sum, record) => sum + record.annotations.length, 0);
    drawingsSummary.textContent = workspace.drawings.length
      ? `${workspace.drawings.length} черт. · ${workspace.sheets.length} лист. · ${totalLines} линий · ${totalAnnotations} анн.`
      : fragments.list.size > 0
        ? "Можно генерировать план/фасады"
        : "Загрузите модель";

    renderDrawingList({
      records: workspace.drawings,
      output: drawingsOutput,
      onSelect: (record) => void fitCameraToDrawing(world, record),
      onExport: downloadDrawingDxf,
      onAnnotate: (record) => void annotateDrawing(record),
      onDelete: (record) => {
        disposeDrawing(record);
        workspace.drawings = workspace.drawings.filter((item) => item.id !== record.id);
        workspace.sheets = workspace.sheets.filter((sheet) => sheet.drawing.id !== record.id);
        persistDrawings();
        renderDrawingsPanel();
      },
    });
  }

  async function annotateActiveDrawing() {
    const record = workspace.drawings[0];
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
      statusText.textContent = `Аннотация добавлена: ${annotation.text}`;
    } catch (error) {
      console.error(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      addAnnotationBtn.loading = false;
    }
  }

  function clearActiveDrawingAnnotations() {
    const record = workspace.drawings[0];
    if (!record) {
      drawingsSummary.textContent = "Сначала сгенерируйте чертёж";
      return;
    }
    clearDrawingAnnotations(record, components);
    persistDrawings();
    renderDrawingsPanel();
    drawingsSummary.textContent = `Аннотации очищены: ${record.name}`;
  }

  function createSheetFromActiveDrawing() {
    const record = workspace.drawings[0];
    if (!record) {
      drawingsSummary.textContent = "Сначала сгенерируйте чертёж";
      return;
    }
    const sheet = createSheet({
      format: sheetFormatSelect.value as SheetFormat,
      drawing: record,
      title: record.name,
      projectName: fileName.textContent && fileName.textContent !== "-" ? fileName.textContent : "BIM Manager Workbench",
    });
    workspace.sheets.unshift(sheet);
    persistDrawings();
    renderDrawingsPanel();
    drawingsSummary.textContent = `Лист создан: ${sheet.format} · ${sheet.title}`;
  }

  function getActiveSheet() {
    if (!workspace.sheets[0]) createSheetFromActiveDrawing();
    return workspace.sheets[0] ?? null;
  }

  function persistDrawings() {
    if (typeof localStorage === "undefined") return null;
    const projectName = fileName.textContent && fileName.textContent !== "-" ? fileName.textContent : "BIM Manager Workbench";
    try {
      return saveDrawingWorkspace(projectName, workspace.drawings, workspace.sheets, components);
    } catch (error) {
      console.warn("Drawing persistence failed", error);
      return null;
    }
  }

  function getStoredDrawingWorkspace(): StoredDrawingWorkspace | null {
    const projectName = fileName.textContent && fileName.textContent !== "-" ? fileName.textContent : "BIM Manager Workbench";
    try {
      return loadStoredDrawingWorkspace(projectName);
    } catch (error) {
      console.warn("Drawing persistence restore failed", error);
      return null;
    }
  }

  function exportActiveSheetSvg() {
    const sheet = getActiveSheet();
    if (!sheet) return;
    downloadSheetSvg(sheet);
    drawingsSummary.textContent = `SVG экспортирован: ${sheet.format}`;
  }

  async function exportActiveSheetPng() {
    const sheet = getActiveSheet();
    if (!sheet) return;
    exportSheetPngBtn.loading = true;
    try {
      await downloadSheetPng(sheet);
      drawingsSummary.textContent = `PNG экспортирован: ${sheet.format}`;
    } catch (error) {
      console.error(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
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
    } catch (error) {
      console.error(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  function exportActiveSheetDxf() {
    const sheet = getActiveSheet();
    if (!sheet) return;
    try {
      downloadSheetDxfPaperSpace(components, sheet);
      drawingsSummary.textContent = `DXF paper-space экспортирован: ${sheet.format}`;
    } catch (error) {
      console.error(error);
      drawingsSummary.textContent = error instanceof Error ? error.message : String(error);
    }
  }

  function exportSpecifications() {
    const source = workspace.filteredElements.length > 0 ? workspace.filteredElements : workspace.elementIndex;
    if (source.length === 0) {
      drawingsSummary.textContent = "Нет элементов для спецификации";
      return;
    }
    const rows = generateSpecification(source);
    downloadTextFile("bim-specification.csv", specificationToCsv(rows), "text/csv;charset=utf-8");
    drawingsSummary.textContent = `Спецификация экспортирована: ${rows.length} строк`;
  }

  function clearDrawings() {
    for (const record of workspace.drawings) disposeDrawing(record);
    workspace.drawings = [];
    workspace.sheets = [];
    clearStoredDrawingWorkspace();
    renderDrawingsPanel();
  }

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
