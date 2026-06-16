export type Vec3 = [number, number, number];
export type BoundingBox = { min: Vec3; max: Vec3 };
export type LodChunkDetail = "coarse" | "detail" | "full";
export type LodChunkSource = "backend" | "generated" | "fallback";

export type LodStableElementId = {
  modelId: string;
  localId: number;
};

export type LodChunkManifest = {
  chunkId: string;
  modelId: string;
  detail: LodChunkDetail;
  localIds: number[];
  stableElementIds: LodStableElementId[];
  box: BoundingBox;
  floorId?: string;
  zoneId?: string;
  categoryIds: string[];
  source: LodChunkSource;
  priority: number;
};

export type LodManifest = {
  modelId: string;
  version: number;
  elementCount: number;
  chunkSize: number;
  generatedAt: string;
  chunks: LodChunkManifest[];
};

export type LodManifestSummary = {
  modelId: string;
  totalChunks: number;
  coarseChunkCount: number;
  detailChunkCount: number;
  fullChunkCount: number;
  totalElementCount: number;
  chunkSize: number;
  hasFallbackChunks: boolean;
};

export type LodChunkInput = Partial<Omit<LodChunkManifest, "stableElementIds" | "localIds" | "categoryIds" | "box" | "priority">> & {
  chunkId: string;
  detail: LodChunkDetail;
  localIds?: number[];
  stableElementIds?: LodStableElementId[];
  categoryIds?: string[];
  box?: Partial<BoundingBox>;
  priority?: number;
};

export function createLodManifest(options: {
  modelId: string;
  chunks: LodChunkInput[];
  elementCount?: number;
  chunkSize?: number;
  version?: number;
  generatedAt?: string;
}): LodManifest {
  const modelId = normalizeText(options.modelId, "model");
  const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? inferChunkSize(options.chunks)));
  const chunks = options.chunks.map((chunk, index) => normalizeChunk(modelId, chunk, index));
  const elementCount = Math.max(0, Math.floor(options.elementCount ?? sumUniqueIds(chunks)));

  return {
    modelId,
    version: Math.max(1, Math.floor(options.version ?? 1)),
    elementCount,
    chunkSize,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    chunks,
  };
}

export function createSyntheticLodManifest(options: {
  modelId: string;
  elementCount: number;
  chunkSize?: number;
  coarsePreviewCount?: number;
}): LodManifest {
  const modelId = normalizeText(options.modelId, "model");
  const elementCount = Math.max(0, Math.floor(options.elementCount));
  const chunkSize = Math.max(1, Math.floor(options.chunkSize ?? 1000));
  const coarsePreviewCount = Math.max(1, Math.min(options.coarsePreviewCount ?? 5, Math.max(1, elementCount)));
  const chunks: LodChunkInput[] = [];

  if (elementCount <= chunkSize) {
    chunks.push({
      chunkId: `${modelId}:full`,
      detail: "full",
      localIds: rangeIds(1, Math.max(1, elementCount)),
      source: "generated",
      priority: 0,
      box: syntheticBox(0),
    });
  } else {
    chunks.push({
      chunkId: `${modelId}:coarse`,
      detail: "coarse",
      localIds: rangeIds(1, coarsePreviewCount),
      source: "fallback",
      priority: 0,
      box: syntheticBox(0),
    });

    const detailChunkCount = Math.max(1, Math.ceil(elementCount / chunkSize));
    for (let index = 0; index < detailChunkCount; index += 1) {
      const start = index * chunkSize + 1;
      const end = Math.min(elementCount, start + chunkSize - 1);
      chunks.push({
        chunkId: `${modelId}:detail-${index}`,
        detail: detailChunkCount === 1 ? "full" : "detail",
        localIds: rangeIds(start, end),
        source: "generated",
        priority: index + 1,
        box: syntheticBox(index + 1),
      });
    }
  }

  return createLodManifest({
    modelId,
    elementCount: Math.max(elementCount, coarsePreviewCount),
    chunkSize,
    chunks,
    version: 1,
  });
}

export function summarizeLodManifest(manifest: LodManifest): LodManifestSummary {
  return {
    modelId: manifest.modelId,
    totalChunks: manifest.chunks.length,
    coarseChunkCount: manifest.chunks.filter((chunk) => chunk.detail === "coarse").length,
    detailChunkCount: manifest.chunks.filter((chunk) => chunk.detail === "detail").length,
    fullChunkCount: manifest.chunks.filter((chunk) => chunk.detail === "full").length,
    totalElementCount: manifest.elementCount,
    chunkSize: manifest.chunkSize,
    hasFallbackChunks: manifest.chunks.some((chunk) => chunk.source === "fallback"),
  };
}

export function getLodChunkStableKey(chunk: LodStableElementId) {
  return `${chunk.modelId}:${chunk.localId}`;
}

export function getLodChunkCoverage(chunk: LodChunkManifest) {
  return {
    chunkId: chunk.chunkId,
    stableKeys: chunk.stableElementIds.map(getLodChunkStableKey),
    localIdCount: chunk.localIds.length,
  };
}

function normalizeChunk(modelId: string, input: LodChunkInput, index: number): LodChunkManifest {
  const localIds = uniqueNumbers(input.localIds ?? input.stableElementIds?.map((item) => item.localId) ?? []);
  const stableElementIds = uniqueStableIds(
    input.stableElementIds ?? localIds.map((localId) => ({ modelId, localId })),
    modelId,
  );
  const categoryIds = uniqueStrings(input.categoryIds ?? []);
  const box = normalizeBox(input.box);

  return {
    chunkId: normalizeText(input.chunkId, `${modelId}:chunk-${index}`),
    modelId,
    detail: input.detail ?? "detail",
    localIds,
    stableElementIds,
    box,
    floorId: normalizeOptionalText(input.floorId),
    zoneId: normalizeOptionalText(input.zoneId),
    categoryIds,
    source: input.source ?? "fallback",
    priority: Math.max(0, Math.floor(input.priority ?? index)),
  };
}

function normalizeBox(box?: Partial<BoundingBox>): BoundingBox {
  return {
    min: normalizeVec3(box?.min, 0),
    max: normalizeVec3(box?.max, 1),
  };
}

function normalizeVec3(vec: Partial<Vec3> | undefined, fallback: number): Vec3 {
  return [
    normalizeNumber(vec?.[0], fallback),
    normalizeNumber(vec?.[1], fallback),
    normalizeNumber(vec?.[2], fallback),
  ];
}

function normalizeStableId(item: LodStableElementId, fallbackModelId: string): LodStableElementId {
  return {
    modelId: normalizeText(item.modelId, fallbackModelId),
    localId: Math.max(0, Math.floor(item.localId)),
  };
}

function uniqueStableIds(items: LodStableElementId[], fallbackModelId: string) {
  const seen = new Set<string>();
  const result: LodStableElementId[] = [];
  for (const item of items) {
    const normalized = normalizeStableId(item, fallbackModelId);
    const key = getLodChunkStableKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function uniqueNumbers(items: number[]) {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const item of items) {
    const normalized = Math.max(0, Math.floor(item));
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function uniqueStrings(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = normalizeOptionalText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function rangeIds(start: number, end: number) {
  if (end < start) return [];
  const result: number[] = [];
  for (let value = start; value <= end; value += 1) result.push(value);
  return result;
}

function syntheticBox(offset: number): BoundingBox {
  const base = offset * 10;
  return {
    min: [base, 0, 0],
    max: [base + 1, 1, 1],
  };
}

function inferChunkSize(chunks: LodChunkInput[]) {
  const filled = chunks.find((chunk) => (chunk.localIds?.length ?? chunk.stableElementIds?.length ?? 0) > 0);
  return filled?.localIds?.length ?? filled?.stableElementIds?.length ?? 1000;
}

function sumUniqueIds(chunks: LodChunkManifest[]) {
  const seen = new Set<string>();
  for (const chunk of chunks) {
    for (const item of chunk.stableElementIds) seen.add(getLodChunkStableKey(item));
  }
  return seen.size;
}

function normalizeText(value: string | undefined, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
