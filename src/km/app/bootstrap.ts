import workerUrl from "@thatopen/fragments/worker?url";
import "../../styles.css";
import { APP_BASE, API_BASE, MAX_FRAGMENT_BYTES } from "../config/index.ts";
import { getDomElements } from "../../bim/dom.ts";
import { createAppStatusController } from "../../bim/app/app-status.ts";
import { createModelController } from "../../bim/app/model-controller.ts";
import { createSearchController } from "../../bim/app/search-controller.ts";
import { createShareController } from "../../bim/app/share-controller.ts";
import { createWorkspaceState } from "../../bim/state/workspace-state.ts";
import { createKmViewerCore } from "../viewer/core.ts";
import { stripKmProfileChrome } from "../../bim/app/km-shell-chrome.ts";
import type { BimAppContext } from "../../bim/app/app-context.ts";

const emptyCapabilities = () => ({
  coordination: false,
  dataBrowser: false,
  drawings: false,
  issues: false,
  qaQc: false,
});

export async function startKmApp() {
  const dom = getDomElements();
  stripKmProfileChrome("km", {
    profileScreen: dom.profileScreen,
    bimStub: dom.bimStub,
  });
  const { viewer, loadIfcModel, loadFragBuffer } = await createKmViewerCore({
    viewport: dom.viewport,
    workerUrl,
    appBase: APP_BASE,
  });
  const workspace = createWorkspaceState();
  const appStatus = createAppStatusController(dom);

  const ctx = {
    dom,
    viewer,
    workspace,
    issueStore: { list: () => [], clear: () => {} },
    ifcOverrideStore: {},
    syncIfcOverrideState: () => {},
    savePropertyOverride: async () => {},
    getCapabilities: emptyCapabilities,
    setStatus: appStatus.setStatus,
    setBusy: appStatus.setBusy,
    setProgress: appStatus.setProgress,
    startOperation: appStatus.startOperation,
    finishOperation: appStatus.finishOperation,
    showToast: appStatus.showToast,
    showError: appStatus.showError,
  } as unknown as BimAppContext;

  const search = createSearchController(ctx);
  const share = createShareController(ctx);
  const model = createModelController({
    ctx,
    clearSearch: search.clearSearch,
    clearDrawings: () => {},
    renderIssues: () => {},
    renderClash: () => {},
    applyDataFilters: () => {},
    refreshClashSelectors: () => {},
    resetDataIndex: () => {},
    resetChecks: () => {},
    clearBBoxIndex: () => {},
    setActiveShareRecord: share.setActiveShareRecord,
    closeLibraryModal: () => {},
    refreshFederationRegistry: () => {},
    persistFederationRegistry: () => {},
  });
  async function saveCurrentFragment() {
    if (!workspace.viewer.lastConvertedModelId || !workspace.viewer.lastSourceIfcName) return;

    const modelRecord = viewer.fragments.list.get(workspace.viewer.lastConvertedModelId);
    if (!modelRecord) {
      appStatus.setStatus("Нет модели для сохранения");
      appStatus.showToast("Нет модели для сохранения", "error");
      return;
    }

    const fragsBuffer = await modelRecord.getBuffer(true);
    if (fragsBuffer.byteLength > MAX_FRAGMENT_BYTES) {
      appStatus.setStatus("Fragment больше 100 МБ");
      appStatus.showToast("Fragment больше 100 МБ", "error");
      return;
    }

    const form = new FormData();
    form.set("name", workspace.viewer.lastSourceIfcName);
    form.set("file", new File([fragsBuffer], `${workspace.viewer.lastSourceIfcName}.frag`, { type: "application/octet-stream" }));

    const response = await fetch(`${API_BASE}/fragments`, { method: "POST", body: form });
    if (!response.ok) throw new Error(await response.text());
    const savedRecord = await response.json();
    share.setActiveShareRecord(savedRecord);
    appStatus.setStatus("Fragment сохранён");
    appStatus.showToast("Fragment сохранён", "success");
  }

  async function openSharedModel() {
    if (!ctx.workspace.viewer.activeShareRecord) {
      await saveCurrentFragment();
    }
    share.openShareModal();
  }

  async function openFragmentFromUrl() {
    const fragmentId = new URLSearchParams(window.location.search).get("fragment")?.trim();
    if (!fragmentId) return;

    appStatus.setBusy(true, "Загрузка модели по ссылке");
    try {
      const response = await fetch(`${API_BASE}/fragments`);
      if (!response.ok) throw new Error("Не удалось получить список fragments");
      const records = await response.json() as Array<{ id: string; name: string }>;
      const record = records.find((item) => item.id === fragmentId);
      if (!record) throw new Error("Модель по ссылке не найдена");

      const download = await fetch(`${API_BASE}/fragments/${record.id}/download`);
      if (!download.ok) throw new Error("Не удалось загрузить fragment");
      await model.loadFragBuffer(await download.arrayBuffer(), record.name, {
        kind: "frag",
        origin: "library",
        label: record.name,
        reference: record.id,
        restorable: true,
      });
      share.setActiveShareRecord(record as any);
      appStatus.setStatus("FRAG загружен из ссылки");
    } catch (error) {
      appStatus.showError(error);
    } finally {
      appStatus.setBusy(false);
    }
  }

  dom.loadIfcBtn.onclick = () => dom.ifcInput.click();
  dom.emptyLoadIfcBtn.onclick = () => dom.ifcInput.click();
  dom.emptyLoadIfcBtn.onkeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dom.ifcInput.click();
    }
  };
  dom.loadFragBtn.onclick = () => dom.fragInput.click();
  dom.fitBtn.onclick = () => void model.fitToModels();
  dom.clearBtn.onclick = () => void model.clearModels();
  dom.downloadFragBtn.onclick = () => void model.downloadFragments();
  dom.hideSelectedBtn.onclick = () => void model.hideSelected();
  dom.isolateSelectedBtn.onclick = () => void model.isolateSelected();
  dom.showAllBtn.onclick = () => void ctx.viewer.hider.set(true);
  dom.searchToggleBtn.onclick = () => search.toggleSearchPanel();
  dom.homeViewBtn.onclick = () => void model.resetHomeView();
  dom.searchBtn.onclick = () => void search.searchItems();
  dom.searchInput.onfocus = () => search.expandSearchPanel();
  dom.searchPanel.onclick = () => {
    if (dom.searchPanel.classList.contains("is-collapsed")) search.expandSearchPanel();
  };
  dom.shareModelBtn.onclick = () => void openSharedModel();
  dom.closeShareBtn.onclick = () => share.closeShareModal();
  dom.copyShareBtn.onclick = () => void share.copyShareLink();
  dom.loadingCancelBtn.onclick = () => appStatus.cancelActiveOperation();

  dom.ifcInput.onchange = async () => {
    const [file] = Array.from(dom.ifcInput.files ?? []) as File[];
    dom.ifcInput.value = "";
    if (!file) return;
    await model.loadIfc(file, {
      kind: "ifc",
      origin: "upload",
      label: file.name,
      reference: file.name,
      restorable: false,
    });
  };

  dom.fragInput.onchange = () => {
    const [file] = Array.from(dom.fragInput.files ?? []) as File[];
    if (file) void model.loadFrag(file);
    dom.fragInput.value = "";
  };

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      share.closeShareModal();
      if (!dom.searchPanel.hidden) search.closeSearchPanel();
      return;
    }
    if (event.code === "Enter" && document.activeElement === dom.searchInput) {
      void search.searchItems();
    }
  });

  model.refreshModelState();
  appStatus.setStatus("Загрузите IFC");
  void openFragmentFromUrl();
}
