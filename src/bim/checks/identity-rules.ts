import type { HealthRuleDefinition } from "./rule-registry.ts";

export const IDENTITY_RULES: HealthRuleDefinition[] = [
  {
    type: "missing-global-id",
    title: "Нет GlobalId",
    severity: "critical",
    group: "identity",
    priority: 200,
    applies: (record) => !record.globalId,
    describe: () => "GlobalId отсутствует, поэтому элемент нельзя стабильно сопоставлять между версиями модели.",
  },
  {
    type: "duplicate-global-id",
    title: "Дубль GlobalId",
    severity: "critical",
    group: "identity",
    priority: 210,
    applies: (record, context) => Boolean(record.globalId && context.duplicateGlobalIds.has(record.globalId)),
    describe: (record) => `GlobalId ${record.globalId} встречается более одного раза в индексе модели.`,
  },
  {
    type: "proxy-overuse",
    title: "Много IfcBuildingElementProxy",
    severity: "info",
    group: "identity",
    priority: 220,
    applies: (record, context) => record.category === "IFCBUILDINGELEMENTPROXY" && context.proxyShare >= 0.1,
    describe: (_record, context) => `Доля IfcBuildingElementProxy около ${Math.round(context.proxyShare * 100)}%. Проверьте классификацию элементов.`,
  },
];
