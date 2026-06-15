export const MODEL_CACHE_DB_NAME = "ifc-wasm-model-cache";
export const MODEL_CACHE_STORE_NAME = "model-chunks";
export const MODEL_CACHE_SCHEMA_VERSION = 1;

export type ModelCacheKey = {
  sourceKey: string;
  chunkId: string;
  schemaVersion: number;
};

export type ModelCacheMetadata = {
  modelId: string;
  byteLength: number;
  schemaVersion: number;
  savedAt: string;
};

export type StoredModelChunk = {
  key: string;
  buffer: ArrayBuffer;
  metadata: ModelCacheMetadata;
};
