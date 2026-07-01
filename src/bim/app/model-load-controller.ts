import { MAX_IFC_BYTES } from "../config.ts";
import { convertLargeIfc } from "../backend/ifc-conversion-client.ts";
import { createFederationLoadQueue } from "../federation/federation-loader.ts";
import type { FederationLoadSource } from "../federation/federation-registry.ts";
import { loadFragBuffer as loadFragmentsBuffer, loadIfcModel } from "../models/model-loader.ts";
import { resolveIfcLoadStrategy } from "../models/ifc-load-strategy.ts";
import type { ModelLoadReportDraft } from "../performance/load-report.ts";
import type { BimAppContext } from "./app-context.ts";

export interface ModelLoadControllerHooks {
  setActiveShareRecord: (record: null) => void;
  closeLibraryModal: () => void;
  refreshFederationState: () => void;
  setLoadReportDraft: (draft: ModelLoadReportDraft | null) => void;
}

type LoadFragBufferOptions = {
  source?: FederationLoadSource;
  lodCache?: {
    seed: (entries: {
      chunkId: string;
      modelId: string;
      bytes: number;
      payload?: unknown;
      source?: "backend" | "generated" | "fallback";
    }[]) => void;
  };
  signal?: AbortSignal;
};

type LoadFragBufferResult = Awaited<ReturnType<typeof loadFragmentsBuffer>>;

export function createModelLoadController(ctx: BimAppContext, hooks: ModelLoadControllerHooks) {
  const { workspace } = ctx;
  const { world, fragments, ifcLoader } = ctx.viewer;
  const { fileName, propertiesOutput, saveFragmentBtn } = ctx.dom;
  const loadQueue = createFederationLoadQueue();

  async function loadIfc(file: File, source?: FederationLoadSource): Promise<void> {
    hooks.setActiveShareRecord(null);
    const strategy = resolveIfcLoadStrategy({ sizeBytes: file.size, maxBrowserBytes: MAX_IFC_BYTES });

    await loadQueue.enqueue(async () => {
      const signal = ctx.startOperation(strategy.kind === "backend-required" ? "Серверная конвертация IFC" : "Конвертация IFC в браузере");
      fileName.textContent = file.name;
      await yieldToUiFrame(signal);
      const conversionStartedAt = performance.now();
      const sourceOrigin = source?.origin ?? "upload";
      hooks.setLoadReportDraft({
        sourceName: file.name,
        ifcSizeBytes: file.size,
        conversionTimeMs: 0,
        sourceKind: "ifc",
        sourceOrigin,
      });

      try {
        if (strategy.kind === "backend-required") {
          propertiesOutput.textContent = `${strategy.message}. IFC > лимита браузера отправляется на backend conversion.`;
          const conversion = await convertLargeIfc(file, {
            signal,
            onStatus: (status) => ctx.setStatus(status),
            onProgress: (value) => ctx.setProgress(value),
          });
          if (signal.aborted) return;
          hooks.setLoadReportDraft({
            sourceName: file.name,
            ifcSizeBytes: file.size,
            fragmentSizeBytes: conversion.artifactBuffer.byteLength,
            conversionTimeMs: performance.now() - conversionStartedAt,
            sourceKind: "ifc",
            sourceOrigin,
          });

          const result = await runLoadFragBuffer(conversion.artifactBuffer, conversion.artifactName, {
            signal,
            lodCache: ctx.viewer.lodChunkCache,
            source: {
              kind: "frag",
              origin: "url",
              label: conversion.sourceFileName,
              reference: conversion.sourceDownloadUrl,
              restorable: false,
            },
          });
          if (signal.aborted) return;

          workspace.viewer.lastConvertedModelId = result.modelId;
          workspace.viewer.lastSourceIfcName = conversion.sourceFileName;
          workspace.data.sourceIfcFiles[result.modelId] = {
            modelId: result.modelId,
            fileName: conversion.sourceFileName,
            downloadUrl: conversion.sourceDownloadUrl,
          };
          workspace.data.progressiveLoadPlan = result.progressivePlan;
          workspace.data.lodManifest = result.lodManifest;
          saveFragmentBtn.hidden = workspace.viewer.activeProfile === "km";
          hooks.closeLibraryModal();
          hooks.refreshFederationState();
          ctx.setStatus(`IFC загружен через backend conversion${result.source.restorable ? " · федерация сохранена" : ""}`);
          ctx.showToast("IFC загружен через backend conversion", "success");
          ctx.setProgress(1);
        } else {
          propertiesOutput.textContent = "IFC читается через web-ifc WASM. Серверная обработка не используется.";
          const result = await loadIfcModel({
            file,
            ifcLoader,
            lodCache: ctx.viewer.lodChunkCache,
            signal,
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
          if (signal.aborted) return;

          hooks.setLoadReportDraft({
            sourceName: file.name,
            ifcSizeBytes: file.size,
            conversionTimeMs: result.performance.totalLoadMs,
            sourceKind: "ifc",
            sourceOrigin,
          });

          workspace.viewer.lastConvertedModelId = result.modelId;
          workspace.viewer.lastSourceIfcName = result.sourceName;
          workspace.data.sourceIfcFiles[result.modelId] = result.sourceIfc;
          workspace.data.progressiveLoadPlan = result.progressivePlan;
          workspace.data.lodManifest = result.lodManifest;
          saveFragmentBtn.hidden = workspace.viewer.activeProfile === "km";
          hooks.closeLibraryModal();
          hooks.refreshFederationState();
          const sectionSuffix = result.source.discipline ? ` · раздел: ${result.source.discipline}` : "";
          ctx.setStatus(`IFC загружен и преобразован${sectionSuffix}${result.source.restorable ? " · федерация сохранена" : ""}`);
          ctx.showToast("IFC загружен и преобразован", "success");
          ctx.setProgress(1);
        }
      } catch (error) {
        hooks.setLoadReportDraft(null);
        hooks.refreshFederationState();
        if (!isAbortError(error)) ctx.showError(error);
      } finally {
        ctx.finishOperation(signal);
      }
    });
  }

  async function loadFrag(file: File) {
    hooks.setActiveShareRecord(null);
    await loadQueue.enqueue(async () => {
      const signal = ctx.startOperation("Загрузка Fragments");
      fileName.textContent = file.name;
      await yieldToUiFrame(signal);

      try {
        await runLoadFragBuffer(await file.arrayBuffer(), file.name, {
          signal,
          source: {
            kind: "frag",
            origin: "upload",
            label: file.name,
            reference: file.name,
            restorable: false,
          },
          lodCache: ctx.viewer.lodChunkCache,
        });
        if (signal.aborted) return;
        ctx.setStatus("FRAG загружен");
        ctx.showToast("FRAG загружен", "success");
        ctx.setProgress(1);
      } catch (error) {
        if (!isAbortError(error)) ctx.showError(error);
      } finally {
        ctx.finishOperation(signal);
      }
    });
  }

  async function loadFragBuffer(buffer: ArrayBuffer, name: string, source?: FederationLoadSource): Promise<void>;
  async function loadFragBuffer(buffer: ArrayBuffer, name: string, options?: LoadFragBufferOptions): Promise<void>;
  async function loadFragBuffer(buffer: ArrayBuffer, name: string, optionsOrSource?: FederationLoadSource | LoadFragBufferOptions): Promise<void> {
    await loadQueue.enqueue(async () => {
      const signal = ctx.startOperation("Загрузка Fragments");
      await yieldToUiFrame(signal);
      try {
        const result = await runLoadFragBuffer(
          buffer,
          name,
          typeof optionsOrSource === "object" && optionsOrSource && ("source" in optionsOrSource || "lodCache" in optionsOrSource || "signal" in optionsOrSource)
            ? optionsOrSource
            : { source: optionsOrSource as FederationLoadSource | undefined, signal },
        );
        if (signal.aborted) return;
        workspace.data.progressiveLoadPlan = result.progressivePlan;
        workspace.data.lodManifest = result.lodManifest;
        ctx.setStatus(`FRAG загружен${result.source.restorable ? " · федерация сохранена" : ""}`);
        ctx.showToast("FRAG загружен", "success");
        ctx.setProgress(1);
      } catch (error) {
        if (!isAbortError(error)) {
          ctx.showError(error);
          throw error;
        }
      } finally {
        ctx.finishOperation(signal);
      }
    });
  }

  async function runLoadFragBuffer(buffer: ArrayBuffer, name: string, options?: LoadFragBufferOptions): Promise<LoadFragBufferResult> {
    const source = options?.source ?? {
      kind: "frag",
      origin: "upload",
      label: name,
      reference: name,
      restorable: false,
    };

    const result = await loadFragmentsBuffer({
      buffer,
      name,
      fragments,
      camera: world.camera.three,
      source,
      signal: options?.signal,
      lodCache: options?.lodCache,
      onProgress: (value, stage) => {
        if (options?.signal?.aborted) return;
        ctx.setStatus(`${formatFragmentStage(stage)}: ${Math.round(value * 100)}%`);
        ctx.setProgress(value);
      },
    });

    hooks.refreshFederationState();
    return result;
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

async function yieldToUiFrame(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Operation aborted", "AbortError");
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
  if (signal?.aborted) throw new DOMException("Operation aborted", "AbortError");
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
