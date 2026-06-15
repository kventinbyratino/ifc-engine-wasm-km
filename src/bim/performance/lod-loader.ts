export type ProgressiveLoadDetail = "coarse" | "detail" | "full";

export type ProgressiveLoadStage = {
  modelId: string;
  detail: ProgressiveLoadDetail;
  chunkIds: string[];
};

export type ProgressiveLoadPlan = {
  modelId: string;
  elementCount: number;
  chunkSize: number;
  totalChunks: number;
  stages: ProgressiveLoadStage[];
};

export function createProgressiveLoadPlan(options: { modelId: string; elementCount: number; chunkSize?: number }): ProgressiveLoadPlan {
  const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? 1000));
  const elementCount = Math.max(0, Math.floor(options.elementCount));
  const totalChunks = Math.max(1, Math.ceil(elementCount / chunkSize));
  const modelId = options.modelId || "model";

  if (totalChunks === 1) {
    return {
      modelId,
      elementCount,
      chunkSize,
      totalChunks,
      stages: [{ modelId, detail: "full", chunkIds: [`${modelId}:full`] }],
    };
  }

  return {
    modelId,
    elementCount,
    chunkSize,
    totalChunks,
    stages: [
      { modelId, detail: "coarse", chunkIds: [`${modelId}:coarse`] },
      { modelId, detail: "detail", chunkIds: Array.from({ length: totalChunks }, (_, index) => `${modelId}:${index}`) },
    ],
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
