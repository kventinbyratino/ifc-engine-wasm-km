import { MAX_IFC_BYTES } from "../config.ts";
import { convertLargeIfc } from "../backend/ifc-conversion-client.ts";
import { createFederationLoadQueue } from "../federation/federation-loader.ts";
import type { FederationLoadSource } from "../federation/federation-registry.ts";
import { loadFragBuffer as loadFragmentsBuffer, loadIfcModel } from "../models/model-loader.ts";
import { resolveIfcLoadStrategy } from "../models/ifc-load-strategy.ts";
import type { BimAppContext } from "./app-context.ts";

export interface ModelLoadControllerHooks {
  setActiveShareRecord: (record: null) => void;
  closeLibraryModal: () => void;
  refreshFederationState: () => void;
}

export function createModelLoadController(ctx: BimAppContext, hooks: ModelLoadControllerHooks) {
  const { workspace } = ctx;
  const { world, fragments, ifcLoader } = ctx.viewer;
  const { fileName, propertiesOutput, saveFragmentBtn } = ctx.dom;
  const loadQueue = createFederationLoadQueue();

  async function loadIfc(file: File, source?: FederationLoadSource) {
    hooks.setActiveShareRecord(null);
    const strategy = resolveIfcLoadStrategy({ sizeBytes: file.size, maxBrowserBytes: MAX_IFC_BYTES });
    if (strategy.kind === "backend-required") {
      await loadQueue.enqueue(async () => {
        ctx.setBusy(true, "Серверная конвертация IFC");
        fileName.textContent = file.name;
        propertiesOutput.textContent = `${strategy.message}. IFC > лимита браузера отправляется на backend conversion.`;

        try {
          const conversion = await convertLargeIfc(file, {
            onStatus: (status) => ctx.setStatus(status),
            onProgress: (value) => ctx.setProgress(value),
          });

          const result = await loadFragBuffer(conversion.artifactBuffer, conversion.artifactName, {
            kind: "frag",
            origin: "url",
            label: conversion.sourceFileName,
            reference: conversion.sourceDownloadUrl,
            restorable: false,
          });

          workspace.viewer.lastConvertedModelId = result.modelId;
          workspace.viewer.lastSourceIfcName = conversion.sourceFileName;
          workspace.data.sourceIfcFiles[result.modelId] = {
            modelId: result.modelId,
            fileName: conversion.sourceFileName,
            downloadUrl: conversion.sourceDownloadUrl,
          };
          workspace.data.progressiveLoadPlan = result.progressivePlan;
          saveFragmentBtn.hidden = false;
          hooks.closeLibraryModal();
          hooks.refreshFederationState();
          ctx.setStatus(`IFC загружен через backend conversion${result.source.restorable ? " · федерация сохранена" : ""}`);
          ctx.showToast("IFC загружен через backend conversion", "success");
          ctx.setProgress(1);
        } catch (error) {
          hooks.refreshFederationState();
          ctx.showError(error);
        } finally {
          ctx.setBusy(false);
        }
      });
      return;
    }

    await loadQueue.enqueue(async () => {
      ctx.setBusy(true, "Конвертация IFC в браузере");
      fileName.textContent = file.name;
      propertiesOutput.textContent = "IFC читается через web-ifc WASM. Серверная обработка не используется.";

      try {
        const result = await loadIfcModel({
          file,
          ifcLoader,
          source: source ?? {
            kind: "ifc",
            origin: "upload",
            label: file.name,
            reference: file.name,
            restorable: false,
          },
          onProgress: (value, process) => {
            ctx.setStatus(`${formatProcess(process)}: ${Math.round(value * 100)}%`);
            ctx.setProgress(value);
          },
        });

        workspace.viewer.lastConvertedModelId = result.modelId;
        workspace.viewer.lastSourceIfcName = result.sourceName;
        workspace.data.sourceIfcFiles[result.modelId] = result.sourceIfc;
        workspace.data.progressiveLoadPlan = result.progressivePlan;
        saveFragmentBtn.hidden = false;
        hooks.closeLibraryModal();
        hooks.refreshFederationState();
        const sectionSuffix = result.source.discipline ? ` · раздел: ${result.source.discipline}` : "";
        ctx.setStatus(`IFC загружен и преобразован${sectionSuffix}${result.source.restorable ? " · федерация сохранена" : ""}`);
        ctx.showToast("IFC загружен и преобразован", "success");
        ctx.setProgress(1);
      } catch (error) {
        hooks.refreshFederationState();
        ctx.showError(error);
      } finally {
        ctx.setBusy(false);
      }
    });
  }

  async function loadFrag(file: File) {
    hooks.setActiveShareRecord(null);
    ctx.setBusy(true, "Загрузка Fragments");
    fileName.textContent = file.name;

    try {
      await loadFragBuffer(await file.arrayBuffer(), file.name, {
        kind: "frag",
        origin: "upload",
        label: file.name,
        reference: file.name,
        restorable: false,
      });
      ctx.setStatus("FRAG загружен");
      ctx.showToast("FRAG загружен", "success");
      ctx.setProgress(1);
    } catch (error) {
      ctx.showError(error);
    } finally {
      ctx.setBusy(false);
    }
  }

  async function loadFragBuffer(buffer: ArrayBuffer, name: string, source?: FederationLoadSource) {
    return loadQueue.enqueue(async () => {
      ctx.setBusy(true, "Загрузка Fragments");
      fileName.textContent = name;

      try {
        const result = await loadFragmentsBuffer({
          buffer,
          name,
          fragments,
          camera: world.camera.three,
          source: source ?? {
            kind: "frag",
            origin: "upload",
            label: name,
            reference: name,
            restorable: false,
          },
          onProgress: (value, stage) => {
            ctx.setStatus(`${formatFragmentStage(stage)}: ${Math.round(value * 100)}%`);
            ctx.setProgress(value);
          },
        });
        hooks.refreshFederationState();
        workspace.data.progressiveLoadPlan = result.progressivePlan;
        ctx.setStatus(`FRAG загружен${result.source.restorable ? " · федерация сохранена" : ""}`);
        ctx.showToast("FRAG загружен", "success");
        ctx.setProgress(1);
        return result;
      } catch (error) {
        hooks.refreshFederationState();
        ctx.showError(error);
        throw error;
      } finally {
        ctx.setBusy(false);
      }
    });
  }

  return { loadIfc, loadFrag, loadFragBuffer };
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
