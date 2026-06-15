import type { BimElementRecord } from "../data/element-index";
import type { FederatedModelSummary } from "./federation.ts";

export type FederationFilterPreset = {
  id: string;
  label: string;
  modelIds: string[];
  disciplines: string[];
  storeys: string[];
  categories: string[];
};

export type FederationFilterState = {
  activePresetId: string;
  selectedModelIds: string[];
  selectedDisciplines: string[];
  selectedStoreys: string[];
  selectedCategories: string[];
  presets: FederationFilterPreset[];
};

export type FederationFilterSelections = Pick<
  FederationFilterState,
  "selectedModelIds" | "selectedDisciplines" | "selectedStoreys" | "selectedCategories"
>;

export type FederationFilterOptions = {
  models: Array<{ value: string; label: string; discipline: string }>;
  disciplines: string[];
  storeys: string[];
  categories: string[];
  presets: FederationFilterPreset[];
};

const BUILTIN_PRESETS: FederationFilterPreset[] = [
  { id: "all", label: "Все модели", modelIds: [], disciplines: [], storeys: [], categories: [] },
  { id: "ar", label: "AR / KR", modelIds: [], disciplines: ["AR", "AR/KR"], storeys: [], categories: [] },
  { id: "mep", label: "MEP", modelIds: [], disciplines: ["MEP"], storeys: [], categories: [] },
  { id: "architectural", label: "AR", modelIds: [], disciplines: ["AR"], storeys: [], categories: [] },
];

export function createFederationFilterState(): FederationFilterState {
  return {
    activePresetId: "all",
    selectedModelIds: [],
    selectedDisciplines: [],
    selectedStoreys: [],
    selectedCategories: [],
    presets: BUILTIN_PRESETS.map(clonePreset),
  };
}

export function applyFederationPreset(state: FederationFilterState, presetId: string) {
  const preset = getFederationPreset(state, presetId);
  if (!preset) return false;
  state.activePresetId = preset.id;
  setFederationFilterSelections(state, preset);
  state.activePresetId = preset.id;
  return true;
}

export function saveFederationPreset(state: FederationFilterState, preset: FederationFilterPreset) {
  const normalized = normalizePreset(preset);
  const index = state.presets.findIndex((item) => item.id === normalized.id);
  if (index >= 0) {
    state.presets[index] = normalized;
  } else {
    state.presets.push(normalized);
  }
  state.activePresetId = normalized.id;
  setFederationFilterSelections(state, normalized);
  state.activePresetId = normalized.id;
}

export function removeFederationPreset(state: FederationFilterState, presetId: string) {
  if (isBuiltinPresetId(presetId)) return false;
  const previousLength = state.presets.length;
  state.presets = state.presets.filter((preset) => preset.id !== presetId);
  if (state.activePresetId === presetId) {
    resetFederationFilters(state);
  }
  return state.presets.length !== previousLength;
}

export function resetFederationFilters(state: FederationFilterState) {
  const preset = getFederationPreset(state, "all") ?? BUILTIN_PRESETS[0];
  state.activePresetId = preset.id;
  setFederationFilterSelections(state, preset);
  state.activePresetId = preset.id;
}

export function setFederationFilterSelections(
  state: FederationFilterState,
  selections: FederationFilterSelections | FederationFilterPreset,
) {
  const modelIds = "selectedModelIds" in selections ? selections.selectedModelIds : selections.modelIds;
  const disciplines = "selectedDisciplines" in selections ? selections.selectedDisciplines : selections.disciplines;
  const storeys = "selectedStoreys" in selections ? selections.selectedStoreys : selections.storeys;
  const categories = "selectedCategories" in selections ? selections.selectedCategories : selections.categories;
  state.selectedModelIds = uniqueSorted(modelIds ?? []);
  state.selectedDisciplines = uniqueSorted(disciplines ?? []);
  state.selectedStoreys = uniqueSorted(storeys ?? []);
  state.selectedCategories = uniqueSorted(categories ?? []);
}

export function normalizeFederationFilterState(
  state: FederationFilterState,
  models: FederatedModelSummary[],
  records: BimElementRecord[],
) {
  const modelIds = new Set(models.map((model) => model.modelId));
  const disciplines = new Set(models.map((model) => model.discipline));
  const storeys = new Set(records.map((record) => record.storey).filter(Boolean));
  const categories = new Set(records.map((record) => record.category).filter(Boolean));

  state.selectedModelIds = state.selectedModelIds.filter((modelId) => modelIds.has(modelId));
  state.selectedDisciplines = state.selectedDisciplines.filter((discipline) => disciplines.has(discipline));
  state.selectedStoreys = state.selectedStoreys.filter((storey) => storeys.has(storey));
  state.selectedCategories = state.selectedCategories.filter((category) => categories.has(category));

  state.presets = state.presets
    .map((preset) => ({
      ...preset,
      modelIds: preset.modelIds.filter((modelId) => modelIds.has(modelId)),
      disciplines: preset.disciplines.filter((discipline) => disciplines.has(discipline)),
      storeys: preset.storeys.filter((storey) => storeys.has(storey)),
      categories: preset.categories.filter((category) => categories.has(category)),
    }))
    .map(normalizePreset);

  if (state.presets.length === 0) {
    state.presets = BUILTIN_PRESETS.map(clonePreset);
    state.activePresetId = "all";
    resetFederationFilters(state);
    return;
  }

  if (!state.presets.some((preset) => preset.id === state.activePresetId)) {
    state.activePresetId = "all";
  }
}

export function applyFederationFilters<T extends BimElementRecord>(
  records: T[],
  models: FederatedModelSummary[],
  state: FederationFilterState,
) {
  if (
    state.selectedModelIds.length === 0 &&
    state.selectedDisciplines.length === 0 &&
    state.selectedStoreys.length === 0 &&
    state.selectedCategories.length === 0
  ) {
    return records;
  }

  const modelDiscipline = new Map(models.map((model) => [model.modelId, model.discipline] as const));
  const modelIds = new Set(state.selectedModelIds);
  const disciplines = new Set(state.selectedDisciplines);
  const storeys = new Set(state.selectedStoreys);
  const categories = new Set(state.selectedCategories);

  return records.filter((record) => {
    if (modelIds.size > 0 && !modelIds.has(record.modelId)) return false;
    if (categories.size > 0 && !categories.has(record.category)) return false;
    if (storeys.size > 0 && !storeys.has(record.storey)) return false;
    if (disciplines.size > 0) {
      const discipline = modelDiscipline.get(record.modelId) ?? "BIM";
      if (!disciplines.has(discipline)) return false;
    }
    return true;
  });
}

export function filterFederationModels<T extends FederatedModelSummary>(models: T[], state: FederationFilterState) {
  if (state.selectedModelIds.length === 0 && state.selectedDisciplines.length === 0) return models;
  const selectedModels = new Set(state.selectedModelIds);
  const selectedDisciplines = new Set(state.selectedDisciplines);
  return models.filter((model) => {
    if (selectedModels.size > 0 && !selectedModels.has(model.modelId)) return false;
    if (selectedDisciplines.size > 0 && !selectedDisciplines.has(model.discipline)) return false;
    return true;
  });
}

export function buildFederationFilterOptions(
  models: FederatedModelSummary[],
  records: BimElementRecord[],
  state: FederationFilterState,
): FederationFilterOptions {
  return {
    models: models
      .map((model) => ({ value: model.modelId, label: `${model.discipline} · ${model.name}`, discipline: model.discipline }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru")),
    disciplines: [...new Set(models.map((model) => model.discipline).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    storeys: [...new Set(records.map((record) => record.storey).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    categories: [...new Set(records.map((record) => record.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru")),
    presets: state.presets,
  };
}

export function getFederationPreset(state: FederationFilterState, presetId: string) {
  return state.presets.find((preset) => preset.id === presetId) ?? null;
}

export function captureFederationPreset(state: FederationFilterState, label: string): FederationFilterPreset {
  return normalizePreset({
    id: slugify(label),
    label,
    modelIds: state.selectedModelIds,
    disciplines: state.selectedDisciplines,
    storeys: state.selectedStoreys,
    categories: state.selectedCategories,
  });
}

function normalizePreset(preset: FederationFilterPreset): FederationFilterPreset {
  return {
    id: slugify(preset.id),
    label: preset.label.trim() || preset.id,
    modelIds: uniqueSorted(preset.modelIds),
    disciplines: uniqueSorted(preset.disciplines),
    storeys: uniqueSorted(preset.storeys),
    categories: uniqueSorted(preset.categories),
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
}

function clonePreset(preset: FederationFilterPreset): FederationFilterPreset {
  return {
    id: preset.id,
    label: preset.label,
    modelIds: [...preset.modelIds],
    disciplines: [...preset.disciplines],
    storeys: [...preset.storeys],
    categories: [...preset.categories],
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "preset";
}

function isBuiltinPresetId(presetId: string) {
  return BUILTIN_PRESETS.some((preset) => preset.id === presetId);
}
