import type { FederationModelRecord } from "../federation/federation-registry.ts";
import {
  filterFederationModels,
  getFederationPreset,
  type FederationFilterOptions,
  type FederationFilterSelections,
  type FederationFilterState,
} from "../federation/federation-filters.ts";
import { escapeHtml } from "./dom-utils.ts";

export type FederationPanelSnapshot = {
  headline: string;
  totalModels: number;
  visibleModels: number;
  totalElements: number;
  emptyMessage: string;
  cards: Array<{
    modelId: string;
    title: string;
    subtitle: string;
    status: string;
    badge: string;
    visible: boolean;
    opacity: number;
    color: string;
    source: string;
  }>;
};

export type FederationPanelActions = {
  onClose: () => void;
  onShowAll: () => void;
  onToggleVisibility: (modelId: string) => void;
  onOpacityChange: (modelId: string, opacity: number) => void;
  onFocus: (modelId: string) => void;
  onIsolate: (modelId: string) => void;
  onRemove: (modelId: string) => void;
  onUpdateFilters: (selections: FederationFilterSelections) => void;
  onApplyPreset: (presetId: string) => void;
  onSavePreset: (label: string) => void;
  onDeletePreset: (presetId: string) => void;
  onResetFilters: () => void;
};

export function buildFederationPanelSnapshot(models: FederationModelRecord[]) {
  const totalModels = models.length;
  const visibleModels = models.filter((model) => model.visible).length;
  const totalElements = models.reduce((sum, model) => sum + model.elementCount, 0);

  if (totalModels === 0) {
    return {
      headline: "Федерация пуста",
      totalModels: 0,
      visibleModels: 0,
      totalElements: 0,
      emptyMessage: "Загрузите хотя бы одну модель, чтобы увидеть controls федерации.",
      cards: [],
    };
  }

  return {
    headline: `${totalModels} models · ${visibleModels} visible · ${totalElements} elements`,
    totalModels,
    visibleModels,
    totalElements,
    emptyMessage: "",
    cards: models.map((model) => ({
      modelId: model.modelId,
      title: `${model.discipline} · ${model.name}`,
      subtitle: `${model.status} · ${model.source.origin} · ${model.source.kind.toUpperCase()}`,
      status: model.status,
      badge: `${model.elementCount}`,
      visible: model.visible,
      opacity: model.opacity,
      color: model.color,
      source: model.source.label,
    })),
  };
}

export function renderFederationPanel(options: {
  models: FederationModelRecord[];
  summary: HTMLElement;
  output: HTMLElement;
  filters: FederationFilterState;
  filterOptions: FederationFilterOptions;
  actions: FederationPanelActions;
}) {
  const filteredModels = filterFederationModels(options.models, options.filters);
  const snapshot = buildFederationPanelSnapshot(filteredModels);
  const activePreset = getFederationPreset(options.filters, options.filters.activePresetId) ??
    getFederationPreset(options.filters, "all") ??
    { label: "Пользовательский набор", id: "custom", modelIds: [], disciplines: [], storeys: [], categories: [] };

  options.summary.textContent = options.models.length
    ? `${snapshot.headline} · preset: ${activePreset.label}`
    : snapshot.emptyMessage;

  const wrapper = document.createElement("div");
  wrapper.className = "federation-list";

  const toolbar = document.createElement("div");
  toolbar.className = "federation-toolbar federation-toolbar--stacked";

  const presetRow = document.createElement("div");
  presetRow.className = "federation-preset-row";

  const presetSelect = document.createElement("select");
  presetSelect.className = "data-select federation-preset-select";
  presetSelect.setAttribute("aria-label", "Пресет федерации");
  for (const preset of options.filterOptions.presets) {
    presetSelect.append(new Option(preset.label, preset.id, false, preset.id === options.filters.activePresetId));
  }
  presetSelect.value = options.filters.activePresetId;

  const applyPresetButton = document.createElement("button");
  applyPresetButton.type = "button";
  applyPresetButton.className = "data-action";
  applyPresetButton.textContent = "Применить";
  applyPresetButton.onclick = () => options.actions.onApplyPreset(presetSelect.value);

  const savePresetButton = document.createElement("button");
  savePresetButton.type = "button";
  savePresetButton.className = "data-action";
  savePresetButton.textContent = "Сохранить";
  savePresetButton.onclick = () => {
    const label = window.prompt("Название пресета федерации", activePreset.label || "Мой пресет");
    if (!label) return;
    options.actions.onSavePreset(label);
  };

  const deletePresetButton = document.createElement("button");
  deletePresetButton.type = "button";
  deletePresetButton.className = "data-action data-action-secondary";
  deletePresetButton.textContent = "Удалить";
  deletePresetButton.onclick = () => options.actions.onDeletePreset(presetSelect.value);

  const resetPresetButton = document.createElement("button");
  resetPresetButton.type = "button";
  resetPresetButton.className = "data-action data-action-secondary";
  resetPresetButton.textContent = "Сброс";
  resetPresetButton.onclick = () => options.actions.onResetFilters();

  presetRow.append(presetSelect, applyPresetButton, savePresetButton, deletePresetButton, resetPresetButton);
  toolbar.append(presetRow);

  const filterGrid = document.createElement("div");
  filterGrid.className = "federation-filter-grid";

  filterGrid.append(
    createMultiSelect("Модели", options.filterOptions.models, options.filters.selectedModelIds, (values) => {
      options.actions.onUpdateFilters({
        selectedModelIds: values,
        selectedDisciplines: options.filters.selectedDisciplines,
        selectedStoreys: options.filters.selectedStoreys,
        selectedCategories: options.filters.selectedCategories,
      });
    }),
    createMultiSelect("Дисциплины", options.filterOptions.disciplines, options.filters.selectedDisciplines, (values) => {
      options.actions.onUpdateFilters({
        selectedModelIds: options.filters.selectedModelIds,
        selectedDisciplines: values,
        selectedStoreys: options.filters.selectedStoreys,
        selectedCategories: options.filters.selectedCategories,
      });
    }),
    createMultiSelect("Этажи", options.filterOptions.storeys, options.filters.selectedStoreys, (values) => {
      options.actions.onUpdateFilters({
        selectedModelIds: options.filters.selectedModelIds,
        selectedDisciplines: options.filters.selectedDisciplines,
        selectedStoreys: values,
        selectedCategories: options.filters.selectedCategories,
      });
    }),
    createMultiSelect("IFC Class", options.filterOptions.categories, options.filters.selectedCategories, (values) => {
      options.actions.onUpdateFilters({
        selectedModelIds: options.filters.selectedModelIds,
        selectedDisciplines: options.filters.selectedDisciplines,
        selectedStoreys: options.filters.selectedStoreys,
        selectedCategories: values,
      });
    }),
  );

  toolbar.append(filterGrid);
  wrapper.append(toolbar);

  if (snapshot.cards.length === 0) {
    wrapper.append(createEmptyState(options.models.length === 0 ? snapshot.emptyMessage : "Фильтр не вернул моделей."));
    options.output.replaceChildren(wrapper);
    return;
  }

  for (const card of snapshot.cards) {
    const item = document.createElement("article");
    item.className = `federation-card${card.visible ? "" : " federation-card-hidden"}`;

    const chip = document.createElement("i");
    chip.className = "federation-card-chip";
    chip.style.background = card.color;

    const meta = document.createElement("div");
    meta.className = "federation-card-meta";
    meta.innerHTML = `
      <strong>${escapeHtml(card.title)}</strong>
      <span>${escapeHtml(card.subtitle)}</span>
      <small>${escapeHtml(card.source)}</small>
    `;

    const badge = document.createElement("span");
    badge.className = "federation-card-badge";
    badge.textContent = card.badge;

    const controls = document.createElement("div");
    controls.className = "federation-card-controls";

    const visibility = document.createElement("button");
    visibility.type = "button";
    visibility.className = "data-action";
    visibility.textContent = card.visible ? "Скрыть" : "Показать";
    visibility.onclick = () => options.actions.onToggleVisibility(card.modelId);

    const focus = document.createElement("button");
    focus.type = "button";
    focus.className = "data-action";
    focus.textContent = "Фокус";
    focus.onclick = () => options.actions.onFocus(card.modelId);

    const isolate = document.createElement("button");
    isolate.type = "button";
    isolate.className = "data-action";
    isolate.textContent = "Изолировать";
    isolate.onclick = () => options.actions.onIsolate(card.modelId);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "data-action data-action-secondary";
    remove.textContent = "Удалить";
    remove.onclick = () => options.actions.onRemove(card.modelId);

    const opacityRow = document.createElement("label");
    opacityRow.className = "federation-opacity";
    opacityRow.innerHTML = `
      <span>Opacity</span>
      <input type="range" min="0" max="1" step="0.05" value="${card.opacity}" aria-label="Opacity ${escapeHtml(card.title)}" />
    `;
    const slider = opacityRow.querySelector("input") as HTMLInputElement | null;
    slider?.addEventListener("input", () => {
      options.actions.onOpacityChange(card.modelId, Number(slider.value));
    });

    controls.append(visibility, focus, isolate, remove, opacityRow);
    item.append(chip, meta, badge, controls);
    wrapper.append(item);
  }

  options.output.replaceChildren(wrapper);
}

function createMultiSelect(
  label: string,
  options: Array<string | { value: string; label: string }>,
  selected: string[],
  onChange: (values: string[]) => void,
) {
  const field = document.createElement("label");
  field.className = "federation-filter-field";

  const title = document.createElement("span");
  title.textContent = label;

  const select = document.createElement("select");
  select.className = "data-select federation-filter-select";
  select.multiple = true;
  select.size = Math.min(Math.max(options.length || 1, 4), 8);

  const selectedSet = new Set(selected);
  for (const entry of options) {
    const value = typeof entry === "string" ? entry : entry.value;
    const text = typeof entry === "string" ? entry : entry.label;
    select.append(new Option(text, value, false, selectedSet.has(value)));
  }

  select.onchange = () => {
    onChange([...select.selectedOptions].map((option) => option.value));
  };

  field.append(title, select);
  return field;
}

function createEmptyState(text: string) {
  const empty = document.createElement("span");
  empty.className = "empty-state";
  empty.textContent = text;
  return empty;
}
