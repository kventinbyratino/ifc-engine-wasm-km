import type { BimAppContext } from "./app-context";
import type { DrawingInteractionController } from "../drawings/drawing-interaction";
import type { BimIssue } from "../issues/issue-types";
import type { ElementRecord } from "../data/element-record";
import type { ModelHealthReport } from "../checks/check-types";

export interface BimUiWiringActions {
  search: {
    searchItems: () => Promise<void>;
    toggleSearchPanel: () => void;
    expandSearchPanel: () => void;
    closeSearchPanel: () => void;
  };
  data: {
    toggleDataPanel: () => void;
    closeDataPanel: () => void;
    applyDataFilters: () => void;
    highlightFilteredElements: () => Promise<void>;
    exportElementsCsv: (records: ElementRecord[]) => void;
    exportElementsJson: (records: ElementRecord[]) => void;
  };
  checks: {
    toggleChecksPanel: () => void;
    closeChecksPanel: () => void;
    loadIDSFile: () => Promise<void>;
    addIDSRequirementFromForm: () => void;
    saveIDSFile: () => void;
    runChecks: () => Promise<void>;
    exportChecksCsv: (report: ModelHealthReport | null) => void;
    exportChecksJson: (report: ModelHealthReport | null) => void;
  };
  issues: {
    toggleIssuesPanel: () => void;
    closeIssuesPanel: () => void;
    createIssueFromSelection: () => Promise<void>;
    renderIssues: () => void;
    exportIssuesJson: (issues: BimIssue[]) => void;
    exportIssuesBcfLikeJson: (issues: BimIssue[]) => void;
  };
  clash: {
    toggleClashPanel: () => void;
    closeClashPanel: () => void;
    runClashDetection: () => Promise<void>;
    clearBBoxIndex: () => void;
    renderClash: () => void;
  };
  federation: {
    togglePanel: () => void;
    closePanel: () => void;
  };
  drawings: {
    toggleDrawingsPanel: () => void;
    closeDrawingsPanel: () => void;
    generateDrawing: () => Promise<void>;
    annotateActiveDrawing: () => Promise<void>;
    clearActiveDrawingAnnotations: () => void;
    createSheetFromActiveDrawing: () => void;
    placeSpecificationsOnActiveSheet: () => void;
    exportActiveSheetSvg: () => void;
    exportActiveSheetPng: () => Promise<void>;
    exportActiveSheetPdf: () => void;
    exportActiveSheetDxf: () => void;
    exportSpecifications: () => void;
    clearDrawings: () => void;
  };
  model: {
    loadIfc: (file: File) => Promise<void>;
    loadFrag: (file: File) => Promise<void>;
    clearModels: () => Promise<void>;
    downloadFragments: () => Promise<void>;
    hideSelected: () => Promise<void>;
    isolateSelected: () => Promise<void>;
    fitToModels: () => Promise<void>;
    resetHomeView: () => Promise<void>;
  };
  profile: {
    navigateToProfile: (profile: "pending" | "km" | "bim") => void;
  };
  library: {
    openLibraryModal: () => void;
    showLibraryStart: () => void;
    showFragmentLibrary: () => Promise<void>;
    closeLibraryModal: () => void;
    openFragmentFromUrl: () => Promise<void>;
    saveCurrentFragment: () => Promise<void>;
  };
  share: {
    openShareModal: () => void;
    closeShareModal: () => void;
    copyShareLink: () => Promise<void>;
  };
  utilities: {
    cancelActiveOperation: () => void;
    clearSelectionInfo: () => void;
  };
}

export function bindBimUiEvents(
  ctx: BimAppContext,
  drawingInteraction: DrawingInteractionController,
  actions: BimUiWiringActions,
) {
  const {
    searchInput,
    searchPanel,
    searchBtn,
    dataBrowserBtn,
    checksBtn,
    issuesBtn,
    clashBtn,
    drawingsBtn,
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
    federationBtn,
    closeFederationPanelBtn,
    closeDataPanelBtn,
    dataSearchInput,
    searchToggleBtn,
    dataCategoryFilter,
    dataStoreyFilter,
    highlightFilteredBtn,
    exportCsvBtn,
    exportJsonBtn,
    closeChecksPanelBtn,
    idsFileInput,
    addIdsRequirementBtn,
    saveIdsBtn,
    runChecksBtn,
    exportChecksCsvBtn,
    exportChecksJsonBtn,
    closeIssuesPanelBtn,
    createIssueBtn,
    exportIssuesJsonBtn,
    exportIssuesBcfBtn,
    clearIssuesBtn,
    closeClashPanelBtn,
    runClashBtn,
    clearClashBtn,
    closeDrawingsPanelBtn,
    generateDrawingBtn,
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
    clearDrawingsBtn,
    profileKmBtn,
    profileBimBtn,
    backToProfilesBtn,
    closeLibraryBtn,
    chooseFragmentBtn,
    addIfcBtn,
    libraryBackBtn,
    saveFragmentBtn,
    shareModelBtn,
    closeShareBtn,
    copyShareBtn,
    loadingCancelBtn,
    ifcInput,
    fragInput,
    topBackBtn,
  } = ctx.dom;

  const { search, data, checks, issues, clash, federation, drawings, model, profile, library, share, utilities } = actions;

  loadIfcBtn.onclick = () => library.openLibraryModal();
  emptyLoadIfcBtn.onclick = () => ifcInput.click();
  emptyExampleBtn.onclick = () => {
    library.openLibraryModal();
    library.showLibraryStart();
  };
  emptyLibraryBtn.onclick = () => {
    library.openLibraryModal();
    void library.showFragmentLibrary();
  };
  loadFragBtn.onclick = () => fragInput.click();
  fitBtn.onclick = () => void model.fitToModels();
  clearBtn.onclick = () => void model.clearModels();
  downloadFragBtn.onclick = () => void model.downloadFragments();
  hideSelectedBtn.onclick = () => void model.hideSelected();
  isolateSelectedBtn.onclick = () => void model.isolateSelected();
  showAllBtn.onclick = () => void ctx.viewer.hider.set(true);
  searchBtn.onclick = () => void search.searchItems();
  searchInput.onfocus = () => search.expandSearchPanel();
  searchPanel.onclick = () => {
    if (searchPanel.classList.contains("is-collapsed")) search.expandSearchPanel();
  };
  dataBrowserBtn.onclick = () => data.toggleDataPanel();
  federationBtn.onclick = () => federation.togglePanel();
  checksBtn.onclick = () => checks.toggleChecksPanel();
  issuesBtn.onclick = () => issues.toggleIssuesPanel();
  clashBtn.onclick = () => clash.toggleClashPanel();
  drawingsBtn.onclick = () => drawings.toggleDrawingsPanel();
  closeDataPanelBtn.onclick = () => data.closeDataPanel();
  closeFederationPanelBtn.onclick = () => federation.closePanel();
  dataSearchInput.oninput = () => data.applyDataFilters();
  dataCategoryFilter.onchange = () => data.applyDataFilters();
  dataStoreyFilter.onchange = () => data.applyDataFilters();
  highlightFilteredBtn.onclick = () => void data.highlightFilteredElements();
  exportCsvBtn.onclick = () => data.exportElementsCsv(ctx.workspace.data.filteredElements);
  exportJsonBtn.onclick = () => data.exportElementsJson(ctx.workspace.data.filteredElements);
  closeChecksPanelBtn.onclick = () => checks.closeChecksPanel();
  idsFileInput.onchange = () => void checks.loadIDSFile();
  addIdsRequirementBtn.onclick = () => checks.addIDSRequirementFromForm();
  saveIdsBtn.onclick = () => checks.saveIDSFile();
  runChecksBtn.onclick = () => void checks.runChecks();
  exportChecksCsvBtn.onclick = () => checks.exportChecksCsv(ctx.workspace.checks.healthReport);
  exportChecksJsonBtn.onclick = () => checks.exportChecksJson(ctx.workspace.checks.healthReport);
  closeIssuesPanelBtn.onclick = () => issues.closeIssuesPanel();
  createIssueBtn.onclick = () => void issues.createIssueFromSelection();
  exportIssuesJsonBtn.onclick = () => issues.exportIssuesJson(ctx.issueStore.list());
  exportIssuesBcfBtn.onclick = () => issues.exportIssuesBcfLikeJson(ctx.issueStore.list());
  clearIssuesBtn.onclick = () => {
    ctx.issueStore.clear();
    issues.renderIssues();
  };
  closeClashPanelBtn.onclick = () => clash.closeClashPanel();
  runClashBtn.onclick = () => void clash.runClashDetection();
  clearClashBtn.onclick = () => {
    ctx.workspace.clash.clashes = [];
    clash.renderClash();
  };
  closeDrawingsPanelBtn.onclick = () => drawings.closeDrawingsPanel();
  generateDrawingBtn.onclick = () => void drawings.generateDrawing();
  addAnnotationBtn.onclick = () => void drawings.annotateActiveDrawing();
  interactiveAnnotationBtn.onclick = () => {
    drawingInteraction.setActive(!drawingInteraction.active);
    interactiveAnnotationBtn.classList.toggle("is-active", drawingInteraction.active);
  };
  clearAnnotationsBtn.onclick = () => drawings.clearActiveDrawingAnnotations();
  createSheetBtn.onclick = () => drawings.createSheetFromActiveDrawing();
  placeSpecsBtn.onclick = () => drawings.placeSpecificationsOnActiveSheet();
  exportSheetSvgBtn.onclick = () => drawings.exportActiveSheetSvg();
  exportSheetPngBtn.onclick = () => void drawings.exportActiveSheetPng();
  exportSheetPdfBtn.onclick = () => drawings.exportActiveSheetPdf();
  exportSheetDxfBtn.onclick = () => drawings.exportActiveSheetDxf();
  exportSpecsBtn.onclick = () => drawings.exportSpecifications();
  clearDrawingsBtn.onclick = () => drawings.clearDrawings();
  profileKmBtn.onclick = () => profile.navigateToProfile("km");
  profileBimBtn.onclick = () => profile.navigateToProfile("bim");
  backToProfilesBtn.onclick = () => profile.navigateToProfile("pending");
  closeLibraryBtn.onclick = () => library.closeLibraryModal();
  chooseFragmentBtn.onclick = () => void library.showFragmentLibrary();
  addIfcBtn.onclick = () => ifcInput.click();
  libraryBackBtn.onclick = () => library.showLibraryStart();
  saveFragmentBtn.onclick = () => void library.saveCurrentFragment();
  shareModelBtn.onclick = () => share.openShareModal();
  closeShareBtn.onclick = () => share.closeShareModal();
  copyShareBtn.onclick = () => void share.copyShareLink();
  loadingCancelBtn.onclick = () => utilities.cancelActiveOperation();
  topBackBtn.onclick = () => profile.navigateToProfile("pending");

  ifcInput.onchange = () => {
    const [file] = ifcInput.files ?? [];
    if (file) void model.loadIfc(file);
    ifcInput.value = "";
  };

  fragInput.onchange = () => {
    const [file] = fragInput.files ?? [];
    if (file) void model.loadFrag(file);
    fragInput.value = "";
  };

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      share.closeShareModal();
      void ctx.viewer.highlighter.clear("select");
      void ctx.viewer.highlighter.clear("search");
      return;
    }

    if (event.code === "Enter" && document.activeElement === searchInput) {
      void search.searchItems();
    }
  });
}
