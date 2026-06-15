import {
  MODEL_CACHE_DB_NAME,
  MODEL_CACHE_SCHEMA_VERSION,
  MODEL_CACHE_STORE_NAME,
  type ModelCacheKey,
  type ModelCacheMetadata,
  type StoredModelChunk,
} from "./indexeddb-schema.ts";

export type ModelChunkCache = {
  getChunk: (key: string) => Promise<StoredModelChunk | null>;
  putChunk: (key: string, buffer: ArrayBuffer, metadata?: Partial<ModelCacheMetadata>) => Promise<StoredModelChunk>;
  clearStaleVersions: (schemaVersion?: number) => Promise<number>;
};

export function createModelCacheKey(key: ModelCacheKey) {
  return `v${key.schemaVersion}:${key.sourceKey}:${key.chunkId}`;
}

export function parseModelCacheVersion(key: string) {
  const match = /^v(\d+):/.exec(key);
  return match ? Number(match[1]) : 0;
}

export function createMemoryModelCache(): ModelChunkCache {
  const chunks = new Map<string, StoredModelChunk>();
  return {
    async getChunk(key) {
      return chunks.get(key) ?? null;
    },
    async putChunk(key, buffer, metadata = {}) {
      const chunk = createStoredChunk(key, buffer, metadata);
      chunks.set(key, chunk);
      return chunk;
    },
    async clearStaleVersions(schemaVersion = MODEL_CACHE_SCHEMA_VERSION) {
      let removed = 0;
      for (const key of [...chunks.keys()]) {
        if (parseModelCacheVersion(key) !== schemaVersion) {
          chunks.delete(key);
          removed++;
        }
      }
      return removed;
    },
  };
}

export function createIndexedDbModelCache(dbName = MODEL_CACHE_DB_NAME): ModelChunkCache {
  if (typeof indexedDB === "undefined") return createMemoryModelCache();

  async function withStore<T>(mode: IDBTransactionMode, handler: (store: IDBObjectStore) => IDBRequest<T> | T) {
    const db = await openDatabase(dbName);
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(MODEL_CACHE_STORE_NAME, mode);
      const store = tx.objectStore(MODEL_CACHE_STORE_NAME);
      const result = handler(store);
      if (result instanceof IDBRequest) {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error);
      } else {
        tx.oncomplete = () => resolve(result);
      }
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    async getChunk(key) {
      return (await withStore<StoredModelChunk | undefined>("readonly", (store) => store.get(key))) ?? null;
    },
    async putChunk(key, buffer, metadata = {}) {
      const chunk = createStoredChunk(key, buffer, metadata);
      await withStore("readwrite", (store) => store.put(chunk));
      return chunk;
    },
    async clearStaleVersions(schemaVersion = MODEL_CACHE_SCHEMA_VERSION) {
      const keys = await withStore<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
      let removed = 0;
      for (const key of keys) {
        if (typeof key === "string" && parseModelCacheVersion(key) !== schemaVersion) {
          await withStore("readwrite", (store) => store.delete(key));
          removed++;
        }
      }
      return removed;
    },
  };
}

function createStoredChunk(key: string, buffer: ArrayBuffer, metadata: Partial<ModelCacheMetadata>): StoredModelChunk {
  return {
    key,
    buffer,
    metadata: {
      modelId: metadata.modelId ?? "",
      byteLength: metadata.byteLength ?? buffer.byteLength,
      schemaVersion: metadata.schemaVersion ?? (parseModelCacheVersion(key) || MODEL_CACHE_SCHEMA_VERSION),
      savedAt: metadata.savedAt ?? new Date().toISOString(),
    },
  };
}

function openDatabase(dbName: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, MODEL_CACHE_SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MODEL_CACHE_STORE_NAME)) {
        db.createObjectStore(MODEL_CACHE_STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
