import type { BimElementRecord } from "../data/element-index.ts";
import { createFederationFilterState, type FederationFilterState } from "./federation-filters.ts";
import { summarizeFederatedModels, type FederatedModelSummary } from "./federation.ts";

export type FederationLoadOrigin = "upload" | "example" | "library" | "url";
export type FederationLoadKind = "ifc" | "frag";

export type FederationLoadSource = {
  kind: FederationLoadKind;
  origin: FederationLoadOrigin;
  label: string;
  reference: string;
  restorable: boolean;
  discipline?: string;
};

export type FederationModelStatus = "queued" | "loading" | "ready" | "failed" | "restoring";

export type FederationModelRecord = FederatedModelSummary & {
  sourceKey: string;
  status: FederationModelStatus;
  visible: boolean;
  opacity: number;
  source: FederationLoadSource;
  error: string;
};

export type FederationRegistryState = {
  models: FederationModelRecord[];
  filters: FederationFilterState;
  restoredFromStorage: boolean;
  lastSavedAt: string | null;
  lastAction: string | null;
  lastActionAt: string | null;
  actionHistory: string[];
};

export function createFederationRegistryState(): FederationRegistryState {
  return {
    models: [],
    filters: createFederationFilterState(),
    restoredFromStorage: false,
    lastSavedAt: null,
    lastAction: null,
    lastActionAt: null,
    actionHistory: [],
  };
}

export function createFederationLoadSource(options: Partial<FederationLoadSource> & { kind: FederationLoadKind; label: string; reference: string }): FederationLoadSource {
  return {
    kind: options.kind,
    origin: options.origin ?? "upload",
    label: options.label,
    reference: options.reference,
    restorable: options.restorable ?? false,
  };
}

export function collectFederationRuntime(models: Iterable<[string, unknown]>) {
  const runtime: Array<{ modelId: string; source: FederationLoadSource }> = [];
  for (const [modelId, model] of models) {
    runtime.push({ modelId, source: readFederationSource(model, modelId) });
  }
  return runtime;
}

export function syncFederationRegistry(options: {
  state: FederationRegistryState;
  models: Iterable<[string, unknown]>;
  records: BimElementRecord[];
}) {
  const summaries = summarizeFederatedModels(options.records);
  const summaryMap = new Map(summaries.map((summary) => [summary.modelId, summary]));
  const existingMap = new Map(options.state.models.map((model) => [model.sourceKey, model]));
  const runtime = collectFederationRuntime(options.models);

  options.state.models = runtime.map(({ modelId, source }) => {
    const summary = summaryMap.get(modelId);
    const existing = existingMap.get(getFederationSourceKey(source));
    return {
      sourceKey: getFederationSourceKey(source),
      modelId,
      name: source.label || summary?.name || existing?.name || modelId,
      discipline: source.discipline ?? summary?.discipline ?? existing?.discipline ?? "BIM",
      color: summary?.color ?? existing?.color ?? "#64748b",
      elementCount: summary?.elementCount ?? existing?.elementCount ?? 0,
      status: existing?.status ?? (source.restorable ? "restoring" : "ready"),
      visible: existing?.visible ?? true,
      opacity: existing?.opacity ?? 1,
      source: source,
      error: existing?.error ?? "",
    };
  });
}

export function upsertFederationModel(state: FederationRegistryState, model: FederationModelRecord) {
  const index = state.models.findIndex((item) => item.modelId === model.modelId);
  if (index >= 0) {
    state.models[index] = model;
    return;
  }
  state.models.push(model);
}

export function removeFederationModel(state: FederationRegistryState, modelId: string) {
  state.models = state.models.filter((model) => model.modelId !== modelId);
}

export function setFederationModelVisibility(state: FederationRegistryState, modelId: string, visible: boolean) {
  const model = state.models.find((item) => item.modelId === modelId);
  if (model) model.visible = visible;
}

export function setFederationModelOpacity(state: FederationRegistryState, modelId: string, opacity: number) {
  const model = state.models.find((item) => item.modelId === modelId);
  if (model) model.opacity = Math.max(0, Math.min(1, opacity));
}

export function setFederationModelStatus(state: FederationRegistryState, modelId: string, status: FederationModelStatus, error = "") {
  const model = state.models.find((item) => item.modelId === modelId);
  if (!model) return;
  model.status = status;
  model.error = error;
}

export function markFederationRestored(state: FederationRegistryState, restoredFromStorage: boolean) {
  state.restoredFromStorage = restoredFromStorage;
}

export function markFederationSaved(state: FederationRegistryState, timestamp = new Date().toISOString()) {
  state.lastSavedAt = timestamp;
}

export function noteFederationAction(state: FederationRegistryState, action: string, timestamp = new Date().toISOString()) {
  const normalized = action.trim();
  if (!normalized) return;
  state.lastAction = normalized;
  state.lastActionAt = timestamp;
  state.actionHistory = [...state.actionHistory.slice(-4), normalized];
}

export function getRestorableFederationModels(state: FederationRegistryState) {
  return state.models.filter((model) => model.source.restorable);
}

function getFederationSourceKey(source: FederationLoadSource) {
  return `${source.kind}:${source.reference}`;
}

function readFederationSource(model: unknown, modelId: string): FederationLoadSource {
  const userData = readUserData(model);
  const source = userData?.federationSource;
  if (isFederationLoadSource(source)) return source;

  const kind = userData?.sourceType === "ifc" ? "ifc" : "frag";
  const label = typeof userData?.sourceName === "string" && userData.sourceName.trim() ? userData.sourceName : modelId;
  const reference = typeof userData?.sourceId === "string" && userData.sourceId.trim() ? userData.sourceId : label;
  return {
    kind,
    origin: "upload",
    label,
    reference,
    restorable: false,
    discipline: typeof userData?.discipline === "string" && userData.discipline.trim() ? userData.discipline.trim() : undefined,
  };
}

function readUserData(model: unknown) {
  if (!model || typeof model !== "object") return null;
  const anyModel = model as { userData?: unknown; object?: { userData?: unknown } };
  const userData = anyModel.userData ?? anyModel.object?.userData;
  if (!userData || typeof userData !== "object") return null;
  return userData as Record<string, unknown>;
}

function isFederationLoadSource(value: unknown): value is FederationLoadSource {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.kind === "ifc" || candidate.kind === "frag") &&
    (candidate.origin === "upload" || candidate.origin === "example" || candidate.origin === "library" || candidate.origin === "url") &&
    typeof candidate.label === "string" &&
    typeof candidate.reference === "string" &&
    typeof candidate.restorable === "boolean" &&
    (candidate.discipline === undefined || typeof candidate.discipline === "string")
  );
}
