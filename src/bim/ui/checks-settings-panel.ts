import type { ModelHealthRuleRegistry } from "../checks/rules";
import { escapeHtml } from "./dom-utils";

export type ChecksSettingsPanelOptions = {
  registry: ModelHealthRuleRegistry;
  summary: HTMLElement;
  output: HTMLElement;
};

export function renderChecksSettingsPanel(options: ChecksSettingsPanelOptions) {
  const { registry, summary, output } = options;
  const rules = registry.listRules();
  const enabledCount = rules.filter((rule) => rule.enabled).length;
  summary.textContent = `${enabledCount}/${rules.length} правил включено · сохраняется локально`;

  const wrapper = document.createElement("div");
  wrapper.className = "checks-settings-list";

  const grouped = rules.reduce<Record<string, typeof rules>>((acc, rule) => {
    (acc[rule.group] ??= []).push(rule);
    return acc;
  }, {});

  for (const group of ["name", "identity", "structure", "material"] as const) {
    const groupRules = grouped[group] ?? [];
    const section = document.createElement("section");
    section.className = "checks-settings-group";

    const title = document.createElement("div");
    title.className = "checks-settings-group-title";
    title.innerHTML = `<strong>${escapeHtml(groupTitle(group))}</strong><span>${groupRules.length} rules</span>`;
    section.append(title);

    if (groupRules.length === 0) {
      const empty = document.createElement("span");
      empty.className = "empty-state";
      empty.textContent = "Нет правил";
      section.append(empty);
      wrapper.append(section);
      continue;
    }

    const grid = document.createElement("div");
    grid.className = "checks-settings-grid";

    for (const rule of groupRules) {
      const card = document.createElement("article");
      card.className = "checks-settings-card";
      card.dataset.ruleType = rule.type;
      card.innerHTML = `
        <label class="checks-settings-toggle">
          <input type="checkbox" data-checks-rule-toggle="${escapeHtml(rule.type)}" ${rule.enabled ? "checked" : ""} />
          <span>
            <strong>${escapeHtml(rule.title)}</strong>
            <small>${escapeHtml(rule.type)} · ${escapeHtml(rule.severity)} · ${rule.priority}</small>
          </span>
        </label>
        <label class="checks-settings-priority">
          <span>Приоритет</span>
          <input type="number" min="1" step="1" value="${rule.priority}" data-checks-rule-priority="${escapeHtml(rule.type)}" />
        </label>
      `;
      grid.append(card);
    }

    section.append(grid);
    wrapper.append(section);
  }

  output.replaceChildren(wrapper);
}

function groupTitle(group: string) {
  if (group === "name") return "Имя";
  if (group === "identity") return "Идентичность";
  if (group === "structure") return "Структура";
  if (group === "material") return "Материал";
  return group;
}
