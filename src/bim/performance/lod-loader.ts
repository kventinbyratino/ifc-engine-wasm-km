import { createSyntheticLodManifest, type LodManifest } from "./lod-manifest.ts";

export type ProgressiveLoadDetail = "coarse" | "detail" | "full";

export type ProgressiveLoadStage = {
  modelId: string;
  detail: ProgressiveLoadDetail;
  chunkIds: string[];
  chunkCount: number;
};

export type ProgressiveLoadPlan = {
  modelId: string;
  elementCount: number;
  chunkSize: number;
  totalChunks: number;
  manifest: LodManifest;
  stages: ProgressiveLoadStage[];
};

export function createProgressiveLoadPlan(options: {
  modelId: string;
  elementCount: number;
  chunkSize?: number;
  manifest?: LodManifest;
}): ProgressiveLoadPlan {
  const modelId = options.modelId || "model";
  const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? 1000));
  const manifest = options.manifest ?? createSyntheticLodManifest({ modelId, elementCount: options.elementCount, chunkSize });
  const totalChunks = manifest.chunks.length || Math.max(1, Math.ceil(Math.max(0, Math.floor(options.elementCount)) / chunkSize));
  const stages = buildStages(manifest, modelId);

  return {
    modelId,
    elementCount: Math.max(0, Math.floor(options.elementCount)),
    chunkSize,
    totalChunks,
    manifest,
    stages,
  };
}

export async function runProgressiveLoadQueue(
  plan: ProgressiveLoadPlan,
  loadStage: (stage: ProgressiveLoadStage) => Promise<void> | void,
) {
  for (const stage of plan.stages) {
    await loadStage(stage);
  }
}

export function shouldUseProgressiveLoading(elementCount: number, chunkSize = 1000) {
  return Math.max(0, elementCount) > Math.max(1, chunkSize);
}

function buildStages(manifest: LodManifest, modelId: string) {
  if (manifest.chunks.length === 0) {
    return [{ modelId, detail: "full" as const, chunkIds: [`${modelId}:full`], chunkCount: 1 }];
  }

  const coarseChunks = manifest.chunks.filter((chunk) => chunk.detail === "coarse");
  const detailChunks = manifest.chunks.filter((chunk) => chunk.detail === "detail");
  const fullChunks = manifest.chunks.filter((chunk) => chunk.detail === "full");

  if (manifest.chunks.length === 1 || (fullChunks.length > 0 && coarseChunks.length === 0 && detailChunks.length === 0)) {
    return [{ modelId, detail: "full" as const, chunkIds: manifest.chunks.map((chunk) => chunk.chunkId), chunkCount: manifest.chunks.length }];
  }

  const stages: ProgressiveLoadStage[] = [];
  if (coarseChunks.length > 0) {
    stages.push({ modelId, detail: "coarse", chunkIds: coarseChunks.map((chunk) => chunk.chunkId), chunkCount: coarseChunks.length });
  }
  if (detailChunks.length > 0) {
    stages.push({ modelId, detail: "detail", chunkIds: detailChunks.map((chunk) => chunk.chunkId), chunkCount: detailChunks.length });
  }
  if (fullChunks.length > 0) {
    stages.push({ modelId, detail: "full", chunkIds: fullChunks.map((chunk) => chunk.chunkId), chunkCount: fullChunks.length });
  }
  if (stages.length === 0) {
    stages.push({ modelId, detail: "full", chunkIds: manifest.chunks.map((chunk) => chunk.chunkId), chunkCount: manifest.chunks.length });
  }
  return stages;
}
