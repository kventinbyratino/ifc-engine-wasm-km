import type { BimAppContext } from "./app-context.ts";
import type { DrawingInteractionController } from "../drawings/drawing-interaction.ts";
import type { BimIssue } from "../issues/issue-types.ts";
import type { ElementRecord } from "../data/element-record.ts";
import type { ModelHealthReport } from "../checks/check-types.ts";

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
    exportIfcFile: (records: ElementRecord[]) => Promise<void>;
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
  help: {
    openHelpPage: () => void;
    closeHelpPage: () => void;
  };
  model: {
    loadIfc: (file: File, source?: { kind: "ifc" | "frag"; origin: "upload" | "example" | "library" | "url"; label: string; reference: string; restorable: boolean; discipline?: string }) => Promise<void>;
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
    helpBtn,
    helpPage,
    closeHelpPageBtn,
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
    homeViewBtn,
    dataCategoryFilter,
    dataStoreyFilter,
    highlightFilteredBtn,
    exportCsvBtn,
    exportJsonBtn,
    exportIfcBtn,
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
    uploadModeModal,
    closeUploadModeBtn,
    uploadSingleBtn,
    uploadMultipleBtn,
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

  const { search, data, checks, issues, clash, federation, drawings, help, model, profile, library, share, utilities } = actions;
  let pendingIfcUploadMode: "single" | "multiple" | null = null;

  function openIfcUploadModeModal() {
    startIfcUpload("single");
  }

  function closeIfcUploadModeModal() {
    uploadModeModal.hidden = true;
  }

  function startIfcUpload(mode: "single" | "multiple") {
    pendingIfcUploadMode = mode;
    ifcInput.multiple = mode === "multiple";
    closeIfcUploadModeModal();
    ifcInput.click();
  }

  function promptIfcDiscipline(fileName: string, index: number, total: number) {
    const promptText =
      total > 1
        ? `Файл ${index + 1}/${total}: ${fileName}\n\nУкажите раздел: ПЗУ, АР, КР, ОВ, ВК, ЭС или другой вариант.`
        : `Укажите раздел для ${fileName}: ПЗУ, АР, КР, ОВ, ВК, ЭС или другой вариант.`;
    const value = window.prompt(promptText, "");
    const discipline = value?.trim();
    return discipline ? discipline : null;
  }

  function buildIfcSource(file: File, discipline?: string) {
    return {
      kind: "ifc" as const,
      origin: "upload" as const,
      label: file.name,
      reference: file.name,
      restorable: false,
      discipline,
    };
  }

  async function openCurrentModelShare() {
    if (!ctx.workspace.viewer.activeShareRecord) {
      await library.saveCurrentFragment();
    }
    share.openShareModal();
  }

  loadIfcBtn.onclick = () => openIfcUploadModeModal();
  emptyLoadIfcBtn.onclick = () => {
    pendingIfcUploadMode = "single";
    ifcInput.multiple = false;
  };
  emptyLoadIfcBtn.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pendingIfcUploadMode = "single";
      ifcInput.multiple = false;
      ifcInput.click();
    }
  };
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
  searchToggleBtn.onclick = () => search.toggleSearchPanel();
  homeViewBtn.onclick = () => void model.resetHomeView();
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
  helpBtn.onclick = () => help.openHelpPage();
  closeHelpPageBtn.onclick = () => help.closeHelpPage();
  closeDataPanelBtn.onclick = () => data.closeDataPanel();
  closeFederationPanelBtn.onclick = () => federation.closePanel();
  dataSearchInput.oninput = () => data.applyDataFilters();
  dataCategoryFilter.onchange = () => data.applyDataFilters();
  dataStoreyFilter.onchange = () => data.applyDataFilters();
  highlightFilteredBtn.onclick = () => void data.highlightFilteredElements();
  exportCsvBtn.onclick = () => data.exportElementsCsv(ctx.workspace.data.filteredElements);
  exportJsonBtn.onclick = () => data.exportElementsJson(ctx.workspace.data.filteredElements);
  exportIfcBtn.onclick = () => void data.exportIfcFile(ctx.workspace.data.filteredElements);
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
  closeUploadModeBtn.onclick = () => closeIfcUploadModeModal();
  uploadSingleBtn.onclick = () => startIfcUpload("single");
  uploadMultipleBtn.onclick = () => startIfcUpload("multiple");
  chooseFragmentBtn.onclick = () => void library.showFragmentLibrary();
  addIfcBtn.onclick = () => openIfcUploadModeModal();
  libraryBackBtn.onclick = () => library.showLibraryStart();
  saveFragmentBtn.onclick = () => void library.saveCurrentFragment();
  shareModelBtn.onclick = () => void openCurrentModelShare();
  closeShareBtn.onclick = () => share.closeShareModal();
  copyShareBtn.onclick = () => void share.copyShareLink();
  loadingCancelBtn.onclick = () => utilities.cancelActiveOperation();
  topBackBtn.onclick = () => profile.navigateToProfile("pending");

  ifcInput.onchange = async () => {
    const files = Array.from(ifcInput.files ?? []);
    const mode = pendingIfcUploadMode ?? (ifcInput.multiple ? "multiple" : "single");
    pendingIfcUploadMode = null;
    ifcInput.value = "";
    ifcInput.multiple = false;
    if (files.length === 0) return;

    if (mode === "single") {
      const [file] = files;
      if (!file) return;
      await model.loadIfc(file, buildIfcSource(file));
      return;
    }

    for (const [index, file] of files.entries()) {
      const discipline = promptIfcDiscipline(file.name, index, files.length);
      if (!discipline) {
        ctx.showToast(`Загрузка остановлена: не указан раздел для ${file.name}`, "error");
        return;
      }
      await model.loadIfc(file, buildIfcSource(file, discipline));
    }
  };

  fragInput.onchange = () => {
    const [file] = fragInput.files ?? [];
    if (file) void model.loadFrag(file);
    fragInput.value = "";
  };

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      share.closeShareModal();
      closeIfcUploadModeModal();
      if (!helpPage.hidden) {
        help.closeHelpPage();
        return;
      }
      void ctx.viewer.highlighter.clear("select");
      void ctx.viewer.highlighter.clear("search");
      return;
    }

    if (event.code === "Enter" && document.activeElement === searchInput) {
      void search.searchItems();
    }
  });
}
