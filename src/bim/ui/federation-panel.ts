import type { FederationModelRecord } from "../federation/federation-registry.ts";
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
};

export function buildFederationPanelSnapshot(models: FederationModelRecord[]): FederationPanelSnapshot {
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
  actions: FederationPanelActions;
}) {
  const snapshot = buildFederationPanelSnapshot(options.models);
  options.summary.textContent = snapshot.totalModels
    ? `${snapshot.totalElements} elements · ${snapshot.visibleModels} visible`
    : snapshot.emptyMessage;

  const wrapper = document.createElement("div");
  wrapper.className = "federation-list";

  const header = document.createElement("div");
  header.className = "federation-toolbar";

  const showAllButton = document.createElement("button");
  showAllButton.type = "button";
  showAllButton.className = "data-action";
  showAllButton.textContent = "Показать все";
  showAllButton.onclick = () => options.actions.onShowAll();

  header.append(showAllButton);
  wrapper.append(header);

  if (snapshot.cards.length === 0) {
    wrapper.append(createEmptyState(snapshot.emptyMessage));
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

function createEmptyState(text: string) {
  const empty = document.createElement("span");
  empty.className = "empty-state";
  empty.textContent = text;
  return empty;
}
