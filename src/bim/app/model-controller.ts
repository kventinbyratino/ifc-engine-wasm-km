import * as THREE from "three";
import { MAX_IFC_BYTES } from "../config";
import { loadFragBuffer as loadFragmentsBuffer, loadIfcModel } from "../models/model-loader";
import { isEmptySelection } from "../selection/selection";
import type { BimAppContext } from "./app-context";

export interface BimModelControllerOptions {
  ctx: BimAppContext;
  clearSearch: () => Promise<void>;
  clearDrawings: () => void;
  renderIssues: () => void;
  renderClash: () => void;
  resetDataIndex: () => void;
  resetChecks: () => void;
  clearBBoxIndex: () => void;
  setActiveShareRecord: (record: null) => void;
  closeLibraryModal: () => void;
}

export function createModelController({
  ctx,
  clearSearch,
  clearDrawings,
  renderIssues,
  renderClash,
  resetDataIndex,
  resetChecks,
  clearBBoxIndex,
  setActiveShareRecord,
  closeLibraryModal,
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
    searchToggleBtn,
    homeViewBtn,
    dataBrowserBtn,
    checksBtn,
    issuesBtn,
    clashBtn,
    drawingsBtn,
    dataPanel,
    checksPanel,
    issuesPanel,
    clashPanel,
    drawingsPanel,
  } = ctx.dom;

  async function loadIfc(file: File) {
    setActiveShareRecord(null);
    if (file.size > MAX_IFC_BYTES) {
      ctx.setStatus("IFC больше 200 МБ");
      return;
    }

    ctx.setBusy(true, "Конвертация IFC в браузере");
    fileName.textContent = file.name;
    propertiesOutput.textContent = "IFC читается через web-ifc WASM. Серверная обработка не используется.";

    try {
      const { modelId, sourceName } = await loadIfcModel({
        file,
        ifcLoader,
        onProgress: (value, process) => {
          ctx.setStatus(`${formatProcess(process)}: ${Math.round(value * 100)}%`);
          ctx.setProgress(value);
        },
      });

      workspace.lastConvertedModelId = modelId;
      workspace.lastSourceIfcName = sourceName;
      saveFragmentBtn.hidden = false;
      closeLibraryModal();
      ctx.setStatus("IFC загружен и преобразован. Можно сохранить fragment");
      ctx.setProgress(1);
    } catch (error) {
      ctx.showError(error);
    } finally {
      ctx.setBusy(false);
    }
  }

  async function loadFrag(file: File) {
    setActiveShareRecord(null);
    ctx.setBusy(true, "Загрузка Fragments");
    fileName.textContent = file.name;

    try {
      await loadFragBuffer(await file.arrayBuffer(), file.name);
      ctx.setStatus("FRAG загружен");
      ctx.setProgress(1);
    } catch (error) {
      ctx.showError(error);
    } finally {
      ctx.setBusy(false);
    }
  }

  async function loadFragBuffer(buffer: ArrayBuffer, name: string) {
    await clearModels({ keepStatus: true });
    await loadFragmentsBuffer({
      buffer,
      name,
      fragments,
      camera: world.camera.three,
      onProgress: (value, stage) => {
        ctx.setStatus(`${formatFragmentStage(stage)}: ${Math.round(value * 100)}%`);
        ctx.setProgress(value);
      },
    });
  }

  async function hideSelected() {
    if (isEmptySelection(workspace.activeSelection)) return;
    await hider.set(false, workspace.activeSelection);
    await highlighter.clear("select");
  }

  async function isolateSelected() {
    if (isEmptySelection(workspace.activeSelection)) return;
    await hider.isolate(workspace.activeSelection);
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
    workspace.clashes = [];
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
    const hasModels = fragments.list.size > 0;
    const capabilities = ctx.getCapabilities();
    modelCount.textContent = String(fragments.list.size);
    loadIfcBtn.hidden = hasModels;
    searchToggleBtn.hidden = !hasModels;
    homeViewBtn.hidden = !hasModels;
    dataBrowserBtn.hidden = !hasModels || !capabilities.dataBrowser;
    checksBtn.hidden = !hasModels || !capabilities.qaQc;
    issuesBtn.hidden = !hasModels || !capabilities.issues;
    clashBtn.hidden = !hasModels || !capabilities.coordination;
    drawingsBtn.hidden = !hasModels || !capabilities.drawings;
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
