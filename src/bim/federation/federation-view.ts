import type { FederatedModelSummary } from "./federation.ts";

export type FederationViewCard = {
  modelId: string;
  label: string;
  badge: string;
  color: string;
  discipline: string;
  elementCount: number;
};

export type FederationViewSnapshot = {
  headline: string;
  totalModels: number;
  totalElements: number;
  disciplines: string[];
  cards: FederationViewCard[];
  emptyMessage: string;
};

export function buildFederationViewSnapshot(models: FederatedModelSummary[]): FederationViewSnapshot {
  const totalModels = models.length;
  const totalElements = models.reduce((sum, model) => sum + model.elementCount, 0);
  const disciplines = [...new Set(models.map((model) => model.discipline).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));

  if (totalModels === 0) {
    return {
      headline: "Загрузите модели",
      totalModels: 0,
      totalElements: 0,
      disciplines: [],
      cards: [],
      emptyMessage: "Загрузите хотя бы одну модель, чтобы увидеть federation summary.",
    };
  }

  return {
    headline: `${totalModels} models · ${totalElements} elements`,
    totalModels,
    totalElements,
    disciplines,
    cards: models.map((model) => ({
      modelId: model.modelId,
      label: `${model.discipline} · ${model.name}`,
      badge: String(model.elementCount),
      color: model.color,
      discipline: model.discipline,
      elementCount: model.elementCount,
    })),
    emptyMessage: "",
  };
}

export function renderFederationView(options: { models: FederatedModelSummary[]; title?: string; emptyMessage?: string }) {
  const snapshot = buildFederationViewSnapshot(options.models);
  const wrapper = document.createElement("section");
  wrapper.className = "federation-view";

  const header = document.createElement("div");
  header.className = "federation-view-header";
  header.innerHTML = `
    <strong>${escapeHtml(options.title ?? snapshot.headline)}</strong>
    <small>${escapeHtml(snapshot.totalModels ? `${snapshot.totalElements} elements · ${snapshot.disciplines.join(", ") || "BIM"}` : options.emptyMessage ?? snapshot.emptyMessage)}</small>
  `;
  wrapper.append(header);

  if (snapshot.cards.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-state";
    empty.textContent = options.emptyMessage ?? snapshot.emptyMessage;
    wrapper.append(empty);
    return wrapper;
  }

  const list = document.createElement("div");
  list.className = "federation-summary";
  for (const card of snapshot.cards) {
    const item = document.createElement("span");
    item.innerHTML = `<i style="background:${escapeHtml(card.color)}"></i>${escapeHtml(card.label)} · ${escapeHtml(card.badge)}`;
    list.append(item);
  }
  wrapper.append(list);
  return wrapper;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[char] ?? char));
}
