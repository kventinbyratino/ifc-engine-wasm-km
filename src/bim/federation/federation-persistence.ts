import {
  createFederationRegistryState,
  markFederationRestored,
  markFederationSaved,
  type FederationLoadSource,
  type FederationRegistryState,
} from "./federation-registry.ts";
import { cloneFederationFilterState, createFederationFilterState, type FederationFilterPreset, type FederationFilterState } from "./federation-filters.ts";
import { clearStoredJson, loadStoredJson, saveStoredJson } from "../storage/local-storage-json.ts";

export const FEDERATION_STORAGE_KEY = "ifc-wasm-viewer:federation:v1";
export const FEDERATION_STORAGE_SCHEMA_VERSION = 1;

export type StoredFederationWorkspace = {
  schemaVersion: number;
  savedAt: string;
  models: FederationRegistryState["models"];
  filters: FederationFilterState;
  restoredFromStorage: boolean;
  lastAction: string | null;
  lastActionAt: string | null;
  actionHistory: string[];
};

export function saveFederationWorkspace(state: FederationRegistryState) {
  const payload = serializeFederationWorkspace(state);
  saveStoredJson(FEDERATION_STORAGE_KEY, payload);
  markFederationSaved(state, payload.savedAt);
  return payload;
}

export function loadStoredFederationWorkspace() {
  return loadStoredJson(FEDERATION_STORAGE_KEY, normalizeStoredFederationWorkspace, "Federation persistence");
}

export function clearStoredFederationWorkspace() {
  clearStoredJson(FEDERATION_STORAGE_KEY);
}

export function serializeFederationWorkspace(state: FederationRegistryState): StoredFederationWorkspace {
  return {
    schemaVersion: FEDERATION_STORAGE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    models: state.models.map((model) => ({
      ...model,
      source: serializeFederationSource(model.source),
    })),
    filters: cloneFederationFilterState(state.filters),
    restoredFromStorage: state.restoredFromStorage,
    lastAction: state.lastAction,
    lastActionAt: state.lastActionAt,
    actionHistory: [...state.actionHistory],
  };
}

export function normalizeStoredFederationWorkspace(raw: unknown): StoredFederationWorkspace | null {
  if (!isRecord(raw)) return null;
  const models = Array.isArray(raw.models) ? raw.models.map(normalizeStoredFederationModel).filter((model): model is FederationRegistryState["models"][number] => model !== null) : [];
  const state = createFederationRegistryState();
  state.models = models;
  state.filters = normalizeStoredFederationFilters(raw.filters);
  state.lastAction = normalizeString(raw.lastAction);
  state.lastActionAt = normalizeString(raw.lastActionAt);
  state.actionHistory = normalizeStringArray(raw.actionHistory).slice(-5);
  markFederationRestored(state, Boolean(raw.restoredFromStorage));
  return {
    schemaVersion: typeof raw.schemaVersion === "number" ? raw.schemaVersion : FEDERATION_STORAGE_SCHEMA_VERSION,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date().toISOString(),
    models: state.models,
    filters: state.filters,
    restoredFromStorage: state.restoredFromStorage,
    lastAction: state.lastAction,
    lastActionAt: state.lastActionAt,
    actionHistory: state.actionHistory,
  };
}

export function restoreFederationState(state: FederationRegistryState, stored: StoredFederationWorkspace) {
  state.models = stored.models.map((model) => ({
    ...model,
    source: normalizeFederationSource(model.source),
  }));
  state.filters = cloneFederationFilterState(stored.filters);
  state.restoredFromStorage = true;
  state.lastSavedAt = stored.savedAt;
  state.lastAction = stored.lastAction;
  state.lastActionAt = stored.lastActionAt;
  state.actionHistory = [...stored.actionHistory];
}

function normalizeStoredFederationFilters(raw: unknown): FederationFilterState {
  const state = createFederationFilterState();
  if (!isRecord(raw)) return state;

  state.activePresetId = normalizeString(raw.activePresetId) ?? state.activePresetId;
  state.selectedModelIds = normalizeStringArray(raw.selectedModelIds);
  state.selectedDisciplines = normalizeStringArray(raw.selectedDisciplines);
  state.selectedStoreys = normalizeStringArray(raw.selectedStoreys);
  state.selectedCategories = normalizeStringArray(raw.selectedCategories);

  if (Array.isArray(raw.presets)) {
    const presets = raw.presets.map(normalizeStoredFederationPreset).filter((preset): preset is FederationFilterPreset => preset !== null);
    if (presets.length > 0) state.presets = presets;
  }

  if (!state.presets.some((preset) => preset.id === state.activePresetId)) {
    state.activePresetId = state.presets[0]?.id ?? "all";
  }

  return state;
}

function normalizeStoredFederationPreset(raw: unknown): FederationFilterPreset | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.label !== "string") return null;
  return {
    id: raw.id.trim() || "preset",
    label: raw.label.trim() || raw.id,
    modelIds: normalizeStringArray(raw.modelIds),
    disciplines: normalizeStringArray(raw.disciplines),
    storeys: normalizeStringArray(raw.storeys),
    categories: normalizeStringArray(raw.categories),
  };
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim());
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
    discipline: typeof raw.discipline === "string" && raw.discipline.trim() ? raw.discipline.trim() : undefined,
  };
}

function serializeFederationSource(source: FederationLoadSource): FederationLoadSource {
  return {
    kind: source.kind,
    origin: source.origin,
    label: source.label,
    reference: source.reference,
    restorable: source.restorable,
    discipline: source.discipline,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
