import type { FederationLoadSource, FederationLoadKind, FederationLoadOrigin } from "../federation/federation-registry.ts";
import { createPerformanceMetricCollector, summarizeLoadPerformance, type LoadPerformanceSummary } from "../performance/performance-metrics.ts";
import { createProgressiveLoadPlan, type ProgressiveLoadPlan } from "../performance/lod-loader.ts";

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
    ...options.source,
  });

  const loadingModel = ifcLoader.load(buffer, true, modelId, {
    userData: {
      sourceName: file.name,
      sourceType: "ifc",
      federationSource: source,
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
  loadingModel.catch((error: unknown) => console.error(error));
  await loadingModel;
  metrics.mark("load-complete");
  const progressivePlan = createProgressiveLoadPlan({ modelId, elementCount: buffer.byteLength, chunkSize: 1_000_000 });
  metrics.setCounts({ elementCount: buffer.byteLength, visibleElementCount: buffer.byteLength, chunkCount: progressivePlan.totalChunks });
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
    ...options.source,
  });
  const loadingModel = fragments.core.load(buffer, {
    modelId,
    camera,
    raw: true,
    userData: {
      sourceName: name,
      sourceType: "frag",
      federationSource: source,
    },
    onProgress: (event: { stage: string; progress: number }) => {
      const value = event.stage === "done" ? 1 : event.progress;
      if (value > 0 && event.stage !== "done") metrics.mark("first-visible");
      onProgress(value, event.stage);
    },
  });
  loadingModel.catch((error: unknown) => console.error(error));
  await loadingModel;
  await fragments.core.update(true);
  metrics.mark("load-complete");
  const progressivePlan = createProgressiveLoadPlan({ modelId, elementCount: buffer.byteLength, chunkSize: 1_000_000 });
  metrics.setCounts({ elementCount: buffer.byteLength, visibleElementCount: buffer.byteLength, chunkCount: progressivePlan.totalChunks });
  options.onPerformance?.(summarizeLoadPerformance(metrics.snapshot()), progressivePlan);

  return { modelId, sourceName: name, source, performance: summarizeLoadPerformance(metrics.snapshot()), progressivePlan };
}

function normalizeLoadSource(source: Partial<FederationLoadSource> & { kind: FederationLoadKind; label: string; reference: string; origin?: FederationLoadOrigin; restorable?: boolean }): FederationLoadSource {
  return {
    kind: source.kind,
    origin: source.origin ?? "upload",
    label: source.label,
    reference: source.reference,
    restorable: source.restorable ?? false,
  };
}
