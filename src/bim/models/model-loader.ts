import type { FederationLoadSource, FederationLoadKind, FederationLoadOrigin } from "../federation/federation-registry.ts";
import { createPerformanceMetricCollector, summarizeLoadPerformance, type LoadPerformanceSummary } from "../performance/performance-metrics.ts";
import { createProgressiveLoadPlan, type ProgressiveLoadPlan } from "../performance/lod-loader.ts";
import { createSyntheticLodManifest, type LodManifest } from "../performance/lod-manifest.ts";
import type { ChunkCacheSeed } from "../performance/chunk-cache.ts";
import { logControllerError } from "../ui/controller-errors.ts";

export function createModelId(name: string) {
  const clean = name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${clean || "model"}_${suffix}`;
}

export async function loadIfcModel(options: {
  file: File;
  ifcLoader: any;
  onProgress: (value: number, process: string) => void;
  source?: Partial<FederationLoadSource> & { kind?: FederationLoadKind };
  onPerformance?: (summary: LoadPerformanceSummary, plan: ProgressiveLoadPlan) => void;
  lodCache?: { seed: (entries: ChunkCacheSeed[]) => void };
}) {
  const { file, ifcLoader, onProgress } = options;
  const metrics = createPerformanceMetricCollector();
  metrics.mark("load-start");
  const sourceBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(sourceBuffer);
  const modelId = createModelId(file.name);
  const source = normalizeLoadSource({
    kind: "ifc",
    label: file.name,
    reference: file.name,
    origin: "upload",
    restorable: false,
    sourceModelId: modelId,
    ...options.source,
  });

  const loadingModel = ifcLoader.load(buffer, true, modelId, {
    userData: {
      sourceName: file.name,
      sourceType: "ifc",
      discipline: source.discipline,
      federationSource: source,
      sourceModelId: modelId,
    },
    instanceCallback: (importer: { addAllAttributes: () => void; addAllRelations: () => void }) => {
      importer.addAllAttributes();
      importer.addAllRelations();
    },
    processData: {
      progressCallback: (value: number, data: { process: string }) => {
        if (value > 0 && data.process === "geometries") metrics.mark("first-visible");
        onProgress(value, data.process);
      },
    },
  });
  loadingModel.catch((error: unknown) => logControllerError(error));
  await loadingModel;
  metrics.mark("load-complete");
  const lodManifest = createSyntheticLodManifest({ modelId, elementCount: buffer.byteLength, chunkSize: 1_000_000 });
  const progressivePlan = createProgressiveLoadPlan({
    modelId,
    elementCount: buffer.byteLength,
    chunkSize: 1_000_000,
    manifest: lodManifest,
  });
  metrics.setCounts({
    elementCount: buffer.byteLength,
    visibleElementCount: lodManifest.chunks[0]?.stableElementIds.length ?? buffer.byteLength,
    chunkCount: progressivePlan.totalChunks,
  });
  options.lodCache?.seed(lodManifest.chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    modelId: chunk.modelId,
    bytes: estimateChunkBytes(buffer.byteLength, lodManifest.chunks.length),
    payload: chunk,
    source: chunk.source,
  })));
  options.onPerformance?.(summarizeLoadPerformance(metrics.snapshot()), progressivePlan);

  return {
    modelId,
    sourceName: file.name,
    source,
    sourceIfc: {
      modelId,
      fileName: file.name,
      buffer: sourceBuffer.slice(0),
    },
    performance: summarizeLoadPerformance(metrics.snapshot()),
    progressivePlan,
    lodManifest,
  };
}

export async function loadFragBuffer(options: {
  buffer: ArrayBuffer;
  name: string;
  fragments: any;
  camera: unknown;
  onProgress: (value: number, stage: string) => void;
  source?: Partial<FederationLoadSource> & { kind?: FederationLoadKind };
  onPerformance?: (summary: LoadPerformanceSummary, plan: ProgressiveLoadPlan) => void;
  lodCache?: { seed: (entries: ChunkCacheSeed[]) => void };
}) {
  const { buffer, name, fragments, camera, onProgress } = options;
  const metrics = createPerformanceMetricCollector();
  metrics.mark("load-start");
  const modelId = createModelId(name);
  const source = normalizeLoadSource({
    kind: "frag",
    label: name,
    reference: name,
    origin: "upload",
    restorable: false,
    sourceModelId: modelId,
    ...options.source,
  });
  const loadingModel = fragments.core.load(buffer, {
    modelId,
    camera,
    raw: true,
    userData: {
      sourceName: name,
      sourceType: "frag",
      discipline: source.discipline,
      federationSource: source,
      sourceModelId: modelId,
    },
    onProgress: (event: { stage: string; progress: number }) => {
      const value = event.stage === "done" ? 1 : event.progress;
      if (value > 0 && event.stage !== "done") metrics.mark("first-visible");
      onProgress(value, event.stage);
    },
  });
  loadingModel.catch((error: unknown) => logControllerError(error));
  await loadingModel;
  await fragments.core.update(true);
  metrics.mark("load-complete");
  const lodManifest = createSyntheticLodManifest({ modelId, elementCount: buffer.byteLength, chunkSize: 1_000_000 });
  const progressivePlan = createProgressiveLoadPlan({
    modelId,
    elementCount: buffer.byteLength,
    chunkSize: 1_000_000,
    manifest: lodManifest,
  });
  metrics.setCounts({
    elementCount: buffer.byteLength,
    visibleElementCount: lodManifest.chunks[0]?.stableElementIds.length ?? buffer.byteLength,
    chunkCount: progressivePlan.totalChunks,
  });
  options.lodCache?.seed(lodManifest.chunks.map((chunk) => ({
    chunkId: chunk.chunkId,
    modelId: chunk.modelId,
    bytes: estimateChunkBytes(buffer.byteLength, lodManifest.chunks.length),
    payload: chunk,
    source: chunk.source,
  })));
  options.onPerformance?.(summarizeLoadPerformance(metrics.snapshot()), progressivePlan);

  return { modelId, sourceName: name, source, performance: summarizeLoadPerformance(metrics.snapshot()), progressivePlan, lodManifest };
}

function estimateChunkBytes(totalBytes: number, chunkCount: number) {
  return Math.max(1, Math.floor(totalBytes / Math.max(1, chunkCount)));
}

function normalizeLoadSource(source: Partial<FederationLoadSource> & { kind: FederationLoadKind; label: string; reference: string; origin?: FederationLoadOrigin; restorable?: boolean }): FederationLoadSource {
  return {
    kind: source.kind,
    origin: source.origin ?? "upload",
    label: source.label,
    reference: source.reference,
    restorable: source.restorable ?? false,
    sourceModelId: typeof source.sourceModelId === "string" && source.sourceModelId.trim() ? source.sourceModelId.trim() : undefined,
    discipline: typeof source.discipline === "string" && source.discipline.trim() ? source.discipline.trim() : undefined,
  };
}
