import workerUrl from "@thatopen/fragments/worker?url";
import "../../styles.css";
import * as THREE from "three";
import { API_BASE, APP_BASE, MAX_FRAGMENT_BYTES } from "../config/index.ts";
import { getDomElements } from "../../bim/dom.ts";
import { createAppStatusController } from "../../bim/app/app-status.ts";
import { createSearchController } from "../../bim/app/search-controller.ts";
import { createShareController } from "../../bim/app/share-controller.ts";
import { createWorkspaceState } from "../../bim/state/workspace-state.ts";
import { stripKmProfileChrome } from "../../bim/app/km-shell-chrome.ts";
import type { BimAppContext } from "../../bim/app/app-context.ts";
import { createKmViewerCore } from "../viewer/core.ts";
import { loadIfcModel as loadKmIfcModel } from "../../bim/models/model-loader.ts";
import { createMessage } from "../../bim/ui/dom-utils.ts";

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

  const { viewer, loadFragBuffer } = await createKmViewerCore({
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

  viewer.fragments.core.onModelLoaded.add((model) => {
    model.useCamera(viewer.world.camera.three);
    viewer.world.scene.three.add(model.object);
  });

  function setActiveShareRecord(record: { id: string; name: string; filename: string; size_bytes: number; created_at: string } | null) {
    workspace.viewer.activeShareRecord = record as any;
    dom.shareModelBtn.hidden = !record;
    if (!record) share.closeShareModal();
  }

  function refreshMinimalViewState(isLoading = false) {
    const hasModels = viewer.fragments.list.size > 0;
    dom.modelCount.textContent = String(viewer.fragments.list.size);
    dom.emptyBimState.hidden = isLoading || hasModels;
    dom.saveFragmentBtn.hidden = true;
    dom.searchToggleBtn.hidden = !hasModels;
    dom.homeViewBtn.hidden = !hasModels;
    dom.shareModelBtn.hidden = !hasModels || !workspace.viewer.activeShareRecord;
  }

  async function loadFragFromBuffer(
    buffer: ArrayBuffer,
    name: string,
    source?: { kind: "frag"; origin: "upload" | "url"; label: string; reference: string; restorable: boolean },
  ) {
    const result = await loadFragBuffer({
      buffer,
      name,
      source: source ?? {
        kind: "frag",
        origin: "upload",
        label: name,
        reference: name,
        restorable: false,
      },
      lodCache: viewer.lodChunkCache,
      onProgress: (value, stage) => {
        const label = stage === "done" ? "Модель загружена" : `Загрузка модели: ${stage}`;
        appStatus.setStatus(`${label} · ${Math.round(value * 100)}%`);
        appStatus.setProgress(value);
      },
    });

    workspace.viewer.lastConvertedModelId = result.modelId;
    workspace.viewer.lastSourceIfcName = result.sourceName;
    workspace.data.progressiveLoadPlan = result.progressivePlan;
    workspace.data.lodManifest = result.lodManifest;
    refreshMinimalViewState();
    return result;
  }

  async function loadIfc(file: File) {
    setActiveShareRecord(null);
    const signal = appStatus.startOperation("Конвертация IFC");
    refreshMinimalViewState(true);
    dom.statusText.textContent = file.name;
    dom.fileName.textContent = file.name;

    try {
      const result = await loadKmIfcModel({
        file,
        ifcLoader: viewer.ifcLoader,
        lodCache: viewer.lodChunkCache,
        signal,
        source: {
          kind: "ifc",
          origin: "upload",
          label: file.name,
          reference: file.name,
          restorable: false,
        },
        onProgress: (value, stage) => {
          const label = stage === "done" ? "Модель загружена" : `Загрузка модели: ${stage}`;
          appStatus.setStatus(`${label} · ${Math.round(value * 100)}%`);
          appStatus.setProgress(value);
        },
      });
      if (signal.aborted) return;

      workspace.viewer.lastConvertedModelId = result.modelId;
      workspace.viewer.lastSourceIfcName = result.sourceName;
      workspace.data.sourceIfcFiles[result.modelId] = result.sourceIfc;
      workspace.data.progressiveLoadPlan = result.progressivePlan;
      workspace.data.lodManifest = result.lodManifest;
      setActiveShareRecord({
        id: result.modelId,
        name: result.sourceName,
        filename: `${result.sourceName}.frag`,
        size_bytes: result.sourceIfc.buffer.byteLength,
        created_at: new Date().toISOString(),
      });
      refreshMinimalViewState();
      await fitToModels();
      appStatus.setStatus("IFC загружен и преобразован");
      appStatus.showToast("IFC загружен и преобразован", "success");
      appStatus.setProgress(1);
    } catch (error) {
      appStatus.showError(error);
    } finally {
      appStatus.finishOperation(signal);
      refreshMinimalViewState();
    }
  }

  async function loadFrag(file: File) {
    setActiveShareRecord(null);
    const signal = appStatus.startOperation("Загрузка модели");
    refreshMinimalViewState(true);
    dom.fileName.textContent = file.name;
    try {
      await loadFragFromBuffer(await file.arrayBuffer(), file.name);
      if (signal.aborted) return;
      await fitToModels();
      appStatus.setStatus("Модель загружена");
      appStatus.showToast("Модель загружена", "success");
      appStatus.setProgress(1);
    } catch (error) {
      appStatus.showError(error);
    } finally {
      appStatus.finishOperation(signal);
      refreshMinimalViewState();
    }
  }

  async function saveCurrentFragment() {
    const modelId = workspace.viewer.lastConvertedModelId;
    const sourceName = workspace.viewer.lastSourceIfcName;
    if (!modelId || !sourceName) return;

    const modelRecord = viewer.fragments.list.get(modelId);
    if (!modelRecord) {
      appStatus.showError(new Error("Нет модели для сохранения"));
      return;
    }

    const fragsBuffer = await modelRecord.getBuffer(true);
    if (fragsBuffer.byteLength > MAX_FRAGMENT_BYTES) {
      appStatus.showError(new Error("Fragment больше 100 МБ"));
      return;
    }

    const form = new FormData();
    form.set("name", sourceName);
    form.set("file", new File([fragsBuffer], `${sourceName}.frag`, { type: "application/octet-stream" }));

    const response = await fetch(`${API_BASE}/fragments`, { method: "POST", body: form });
    if (!response.ok) throw new Error(await response.text());
    const savedRecord = await response.json();
    share.setActiveShareRecord(savedRecord);
    appStatus.setStatus("Модель сохранена");
    appStatus.showToast("Модель сохранена", "success");
  }

  async function openSharedModel() {
    if (!workspace.viewer.activeShareRecord) {
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
      const records = (await response.json()) as Array<{ id: string; name: string }>;
      const record = records.find((item) => item.id === fragmentId);
      if (!record) throw new Error("Модель по ссылке не найдена");

      const download = await fetch(`${API_BASE}/fragments/${record.id}/download`);
      if (!download.ok) throw new Error("Не удалось загрузить fragment");
      await loadFragFromBuffer(await download.arrayBuffer(), record.name, {
        kind: "frag",
        origin: "url",
        label: record.name,
        reference: record.id,
        restorable: true,
      });
      share.setActiveShareRecord({
        id: record.id,
        name: record.name,
        filename: `${record.name}.frag`,
        size_bytes: 0,
        created_at: new Date().toISOString(),
      });
      appStatus.setStatus("Модель загружена из ссылки");
    } catch (error) {
      appStatus.showError(error);
    } finally {
      appStatus.setBusy(false);
    }
  }

  dom.loadIfcBtn.onclick = () => dom.ifcInput.click();
  dom.loadFragBtn.onclick = () => dom.fragInput.click();
  dom.fitBtn.onclick = () => void fitToModels();
  dom.clearBtn.onclick = () => void clearModels();
  dom.downloadFragBtn.onclick = () => void downloadFragments();
  dom.hideSelectedBtn.onclick = () => void viewer.hider.set(false, workspace.viewer.activeSelection);
  dom.isolateSelectedBtn.onclick = () => void viewer.hider.isolate(workspace.viewer.activeSelection);
  dom.showAllBtn.onclick = () => void viewer.hider.set(true);
  dom.searchToggleBtn.onclick = () => search.toggleSearchPanel();
  dom.homeViewBtn.onclick = () => void resetHomeView();
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
    await loadIfc(file);
  };

  dom.fragInput.onchange = async () => {
    const [file] = Array.from(dom.fragInput.files ?? []) as File[];
    dom.fragInput.value = "";
    if (!file) return;
    await loadFrag(file);
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
  async function fitToModels() {
    await viewer.fragments.core.update(true);
    const objects = [...viewer.fragments.list.values()].map((model) => model.object);
    if (objects.length === 0) return;

    const box = new THREE.Box3();
    for (const object of objects) {
      object.updateWorldMatrix(true, true);
      box.expandByObject(object);
    }

    if (!box.isEmpty()) {
      await viewer.world.camera.controls.fitToBox(box, true, {
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
      });
    }
  }

  async function resetHomeView() {
    await viewer.world.camera.controls.setLookAt(24, 18, 24, 0, 0, 0, true);
    await fitToModels();
  }

  async function clearModels() {
    for (const [modelId] of viewer.fragments.list) {
      await viewer.fragments.core.disposeModel(modelId);
    }
    await viewer.highlighter.clear("select");
    await search.clearSearch();
    workspace.viewer.lastConvertedModelId = "";
    workspace.viewer.lastSourceIfcName = "";
    workspace.data.sourceIfcFiles = {};
    workspace.data.progressiveLoadPlan = null;
    workspace.data.lodManifest = null;
    setActiveShareRecord(null);
    dom.searchPanel.hidden = true;
    dom.searchOutput.replaceChildren(createMessage("Введите текст поиска."));
    dom.fileName.textContent = "-";
    refreshMinimalViewState();
  }

  async function downloadFragments() {
    for (const [, model] of viewer.fragments.list) {
      const fragsBuffer = await model.getBuffer(true);
      const file = new File([fragsBuffer], `${model.modelId}.frag`);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  }

  refreshMinimalViewState();
  appStatus.setStatus("Загрузите IFC");
  void openFragmentFromUrl();
}
