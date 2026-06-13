import type { HealthRuleDefinition } from "./rule-registry";

export const NAME_RULES: HealthRuleDefinition[] = [
  {
    type: "missing-name",
    title: "Пустой Name",
    severity: "warning",
    group: "name",
    priority: 100,
    applies: (record) => !record.name || record.name === `#${record.localId}`,
    describe: () => "У элемента нет человекочитаемого имени. Это усложняет навигацию, спецификации и issue tracking.",
  },
  {
    type: "space-missing-name-or-number",
    title: "Помещение без имени/номера",
    severity: "warning",
    group: "name",
    priority: 110,
    applies: (record) => record.category === "IFCSPACE" && !(record.name && record.number),
    describe: () => "Помещение должно иметь Name и номер/Tag/LongName для ведомостей помещений.",
  },
];

export function hasReadableName(record: { name: string; localId: number }) {
  return Boolean(record.name && record.name !== `#${record.localId}`);
}
