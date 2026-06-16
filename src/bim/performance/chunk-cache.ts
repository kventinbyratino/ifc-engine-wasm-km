export type ChunkCacheSource = "backend" | "generated" | "fallback";

export type ChunkCacheEntry<T = unknown> = {
  chunkId: string;
  modelId: string;
  bytes: number;
  payload: T;
  source: ChunkCacheSource;
  createdAt: number;
  lastAccessedAt: number;
};

export type ChunkCacheSeed<T = unknown> = {
  chunkId: string;
  modelId: string;
  bytes: number;
  payload?: T;
  source?: ChunkCacheSource;
};

export type ChunkCacheSnapshot = {
  size: number;
  totalBytes: number;
  hits: number;
  misses: number;
  evictions: number;
  chunkIds: string[];
  modelIds: string[];
  bytesByChunkId: Record<string, number>;
};

export function createChunkCache(options: { maxChunks?: number; maxBytes?: number } = {}) {
  const maxChunks = Math.max(1, Math.floor(options.maxChunks ?? 24));
  const maxBytes = Math.max(1, Math.floor(options.maxBytes ?? 128 * 1024 * 1024));
  const entries = new Map<string, ChunkCacheEntry>();
  let totalBytes = 0;
  let hits = 0;
  let misses = 0;
  let evictions = 0;

  function set<T>(entry: ChunkCacheSeed<T>) {
    const normalized = normalizeEntry(entry);
    const existing = entries.get(normalized.chunkId);
    if (existing) totalBytes -= existing.bytes;
    entries.set(normalized.chunkId, normalized);
    totalBytes += normalized.bytes;
    evictOverflow();
    return normalized;
  }

  function seed<T>(seedEntries: ChunkCacheSeed<T>[]) {
    for (const entry of seedEntries) set(entry);
  }

  function get(chunkId: string) {
    const entry = entries.get(chunkId);
    if (!entry) {
      misses += 1;
      return undefined;
    }
    hits += 1;
    entries.delete(chunkId);
    entry.lastAccessedAt = now();
    entries.set(chunkId, entry);
    return entry;
  }

  function has(chunkId: string) {
    return entries.has(chunkId);
  }

  function remove(chunkId: string) {
    const entry = entries.get(chunkId);
    if (!entry) return false;
    entries.delete(chunkId);
    totalBytes -= entry.bytes;
    return true;
  }

  function clear() {
    entries.clear();
    totalBytes = 0;
  }

  function snapshot(): ChunkCacheSnapshot {
    const bytesByChunkId: Record<string, number> = {};
    const modelIds = new Set<string>();
    for (const entry of entries.values()) {
      bytesByChunkId[entry.chunkId] = entry.bytes;
      modelIds.add(entry.modelId);
    }
    return {
      size: entries.size,
      totalBytes,
      hits,
      misses,
      evictions,
      chunkIds: [...entries.keys()],
      modelIds: [...modelIds],
      bytesByChunkId,
    };
  }

  function evictOverflow() {
    while (entries.size > maxChunks || totalBytes > maxBytes) {
      let oldest: ChunkCacheEntry | null = null;
      for (const entry of entries.values()) {
        if (!oldest) {
          oldest = entry;
          continue;
        }
        if (entry.lastAccessedAt < oldest.lastAccessedAt) {
          oldest = entry;
          continue;
        }
        if (entry.lastAccessedAt === oldest.lastAccessedAt && entry.createdAt < oldest.createdAt) oldest = entry;
      }
      if (!oldest) break;
      entries.delete(oldest.chunkId);
      totalBytes -= oldest.bytes;
      evictions += 1;
    }
  }

  return { set, seed, get, has, remove, clear, snapshot };
}

function normalizeEntry<T>(entry: ChunkCacheSeed<T>): ChunkCacheEntry<T> {
  const nowAt = now();
  return {
    chunkId: normalizeText(entry.chunkId, "chunk"),
    modelId: normalizeText(entry.modelId, "model"),
    bytes: Math.max(1, Math.floor(entry.bytes)),
    payload: entry.payload as T,
    source: entry.source ?? "fallback",
    createdAt: nowAt,
    lastAccessedAt: nowAt,
  };
}

function normalizeText(value: string | undefined, fallback: string) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function now() {
  return Date.now();
}
