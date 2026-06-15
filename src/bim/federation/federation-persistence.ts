import {
  createFederationRegistryState,
  markFederationRestored,
  markFederationSaved,
  type FederationLoadSource,
  type FederationRegistryState,
} from "./federation-registry.ts";

export const FEDERATION_STORAGE_KEY = "ifc-wasm-viewer:federation:v1";
export const FEDERATION_STORAGE_SCHEMA_VERSION = 1;

export type StoredFederationWorkspace = {
  schemaVersion: number;
  savedAt: string;
  models: FederationRegistryState["models"];
  restoredFromStorage: boolean;
};

export function saveFederationWorkspace(state: FederationRegistryState) {
  const payload = serializeFederationWorkspace(state);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(FEDERATION_STORAGE_KEY, JSON.stringify(payload));
  }
  markFederationSaved(state, payload.savedAt);
  return payload;
}

export function loadStoredFederationWorkspace() {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(FEDERATION_STORAGE_KEY);
  if (!raw) return null;

  try {
    return normalizeStoredFederationWorkspace(JSON.parse(raw) as unknown);
  } catch (error) {
    console.warn("Federation persistence parse failed", error);
    return null;
  }
}

export function clearStoredFederationWorkspace() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(FEDERATION_STORAGE_KEY);
}

export function serializeFederationWorkspace(state: FederationRegistryState): StoredFederationWorkspace {
  return {
    schemaVersion: FEDERATION_STORAGE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    models: state.models.map((model) => ({
      ...model,
      source: serializeFederationSource(model.source),
    })),
    restoredFromStorage: state.restoredFromStorage,
  };
}

export function normalizeStoredFederationWorkspace(raw: unknown): StoredFederationWorkspace | null {
  if (!isRecord(raw)) return null;
  const models = Array.isArray(raw.models) ? raw.models.map(normalizeStoredFederationModel).filter((model): model is FederationRegistryState["models"][number] => model !== null) : [];
  const state = createFederationRegistryState();
  state.models = models;
  markFederationRestored(state, Boolean(raw.restoredFromStorage));
  return {
    schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : FEDERATION_STORAGE_SCHEMA_VERSION,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString(),
    models: state.models,
    restoredFromStorage: state.restoredFromStorage,
  };
}

export function restoreFederationState(state: FederationRegistryState, stored: StoredFederationWorkspace) {
  state.models = stored.models.map((model) => ({
    ...model,
    source: normalizeFederationSource(model.source),
  }));
  state.restoredFromStorage = true;
  state.lastSavedAt = stored.savedAt;
}

function normalizeStoredFederationModel(raw: Record<string, unknown>) {
  if (
    typeof raw.sourceKey !== "string" ||
    typeof raw.modelId !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.discipline !== "string" ||
    typeof raw.color !== "string" ||
    typeof raw.elementCount !== "number" ||
    typeof raw.status !== "string" ||
    typeof raw.visible !== "boolean" ||
    typeof raw.opacity !== "number" ||
    typeof raw.error !== "string" ||
    !isRecord(raw.source)
  ) {
    return null;
  }

  return {
    sourceKey: raw.sourceKey,
    modelId: raw.modelId,
    name: raw.name,
    discipline: raw.discipline,
    color: raw.color,
    elementCount: raw.elementCount,
    status: raw.status as FederationRegistryState["models"][number]["status"],
    visible: raw.visible,
    opacity: raw.opacity,
    error: raw.error,
    source: normalizeFederationSource(raw.source),
  };
}

function normalizeFederationSource(raw: Record<string, unknown>): FederationLoadSource {
  return {
    kind: raw.kind === "ifc" ? "ifc" : "frag",
    origin: raw.origin === "example" || raw.origin === "library" || raw.origin === "url" ? raw.origin : "upload",
    label: typeof raw.label === "string" ? raw.label : "Model",
    reference: typeof raw.reference === "string" ? raw.reference : "",
    restorable: Boolean(raw.restorable),
  };
}

function serializeFederationSource(source: FederationLoadSource): FederationLoadSource {
  return {
    kind: source.kind,
    origin: source.origin,
    label: source.label,
    reference: source.reference,
    restorable: source.restorable,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
