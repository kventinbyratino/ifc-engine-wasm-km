import type { FederatedModelSummary } from "../federation/federation.ts";
import { renderFederationView } from "../federation/federation-view.ts";
import type { ClashRecord } from "../clash/clash-types.ts";
import { createMessage, escapeHtml } from "./dom-utils.ts";

export type ClashPanelOptions = {
  models: FederatedModelSummary[];
  clashes: ClashRecord[];
  output: HTMLElement;
  summary: HTMLElement;
  onSelect: (clash: ClashRecord) => void;
  onCreateIssue: (clash: ClashRecord) => void;
};

export function fillClashGroupSelect(
  select: HTMLSelectElement,
  options: { models: FederatedModelSummary[]; categories: string[]; storeys: string[]; disciplines: string[] },
) {
  const current = select.value;
  select.replaceChildren(new Option("Все элементы", "all"));

  if (options.models.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "Модели";
    for (const model of options.models) {
      group.append(new Option(`${model.discipline}: ${model.name}`, `model:${model.modelId}`));
    }
    select.append(group);
  }

  if (options.categories.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "IFC Class";
    for (const category of options.categories) group.append(new Option(category, `category:${category}`));
    select.append(group);
  }

  if (options.storeys.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "Этажи";
    for (const storey of options.storeys) group.append(new Option(storey, `storey:${storey}`));
    select.append(group);
  }

  if (options.disciplines.length > 0) {
    const group = document.createElement("optgroup");
    group.label = "Дисциплины";
    for (const discipline of options.disciplines) group.append(new Option(discipline, `discipline:${discipline}`));
    select.append(group);
  }

  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

export function renderClashPanel(options: ClashPanelOptions) {
  const { models, clashes, output, summary, onSelect, onCreateIssue } = options;
  summary.textContent = clashes.length
    ? `${clashes.length} clash · ${models.length} models`
    : models.length
      ? `${models.length} models · clash не запускался/не найден`
      : "Загрузите модель";

  const wrapper = document.createElement("div");
  wrapper.className = "clash-list";

  if (models.length > 0) {
    const modelsBlock = renderFederationView({ models, title: "Federation" });
    wrapper.append(modelsBlock);
  }

  if (clashes.length === 0) {
    wrapper.append(createMessage("Выберите две группы и нажмите “Найти clash”."));
    output.replaceChildren(wrapper);
    return;
  }

  for (const clash of clashes.slice(0, 100)) wrapper.append(createClashCard(clash, onSelect, onCreateIssue));
  if (clashes.length > 100) {
    const more = document.createElement("span");
    more.className = "data-more";
    more.textContent = `Показаны первые 100 из ${clashes.length}.`;
    wrapper.append(more);
  }

  output.replaceChildren(wrapper);
}

function createClashCard(
  clash: ClashRecord,
  onSelect: (clash: ClashRecord) => void,
  onCreateIssue: (clash: ClashRecord) => void,
) {
  const card = document.createElement("article");
  card.className = `clash-card clash-card-${clash.severity}`;

  const main = document.createElement("div");
  main.className = "clash-card-main";
  main.innerHTML = `
    <strong>${escapeHtml(clash.title)}</strong>
    <span>${escapeHtml(clash.description)}</span>
    <small>${escapeHtml(clash.a.modelId)}:${clash.a.localId} ↔ ${escapeHtml(clash.b.modelId)}:${clash.b.localId}</small>
  `;

  const actions = document.createElement("div");
  actions.className = "clash-card-actions";

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.textContent = "Показать";
  selectButton.onclick = () => onSelect(clash);

  const issueButton = document.createElement("button");
  issueButton.type = "button";
  issueButton.textContent = "Issue";
  issueButton.onclick = () => onCreateIssue(clash);

  actions.append(selectButton, issueButton);
  card.append(main, actions);
  return card;
}
