import type { BimElementRecord } from "../data/element-index";
import type { HealthCheckIssue, HealthCheckIssueType, HealthCheckSeverity } from "./check-types";

type RuleContext = {
  duplicateGlobalIds: Set<string>;
  proxyShare: number;
};

type HealthRule = {
  type: HealthCheckIssueType;
  title: string;
  severity: HealthCheckSeverity;
  applies: (record: BimElementRecord, context: RuleContext) => boolean;
  describe: (record: BimElementRecord, context: RuleContext) => string;
};

export const MODEL_HEALTH_RULES: HealthRule[] = [
  {
    type: "missing-name",
    title: "Пустой Name",
    severity: "warning",
    applies: (record) => !record.name || record.name === `#${record.localId}`,
    describe: () => "У элемента нет человекочитаемого имени. Это усложняет навигацию, спецификации и issue tracking.",
  },
  {
    type: "missing-global-id",
    title: "Нет GlobalId",
    severity: "critical",
    applies: (record) => !record.globalId,
    describe: () => "GlobalId отсутствует, поэтому элемент нельзя стабильно сопоставлять между версиями модели.",
  },
  {
    type: "duplicate-global-id",
    title: "Дубль GlobalId",
    severity: "critical",
    applies: (record, context) => Boolean(record.globalId && context.duplicateGlobalIds.has(record.globalId)),
    describe: (record) => `GlobalId ${record.globalId} встречается более одного раза в индексе модели.`,
  },
  {
    type: "missing-storey",
    title: "Нет этажа",
    severity: "warning",
    applies: (record) => isBuildingElement(record) && !record.storey,
    describe: () => "Элемент не связан с этажом/Building Storey. Фильтры по этажам и планы будут неполными.",
  },
  {
    type: "missing-type",
    title: "Нет типа",
    severity: "warning",
    applies: (record) => isBuildingElement(record) && !record.typeName,
    describe: () => "Не найден ObjectType/PredefinedType/Tag. Для BIM manager это снижает качество фильтрации и ведомостей.",
  },
  {
    type: "proxy-overuse",
    title: "Много IfcBuildingElementProxy",
    severity: "info",
    applies: (record, context) => record.category === "IFCBUILDINGELEMENTPROXY" && context.proxyShare >= 0.1,
    describe: (_record, context) => `Доля IfcBuildingElementProxy около ${Math.round(context.proxyShare * 100)}%. Проверьте классификацию элементов.`,
  },
  {
    type: "empty-property-sets",
    title: "Пустые psets",
    severity: "warning",
    applies: (record) => isBuildingElement(record) && record.psetCount === 0,
    describe: () => "У элемента не найдено property sets. Проверки, спецификации и AI-аудит будут ограничены.",
  },
  {
    type: "door-missing-fire-rating",
    title: "Дверь без FireRating",
    severity: "critical",
    applies: (record) => record.category === "IFCDOOR" && !record.searchable.includes("firerating"),
    describe: () => "Дверь не содержит FireRating/Pset_DoorCommon.FireRating в извлечённых атрибутах.",
  },
  {
    type: "space-missing-name-or-number",
    title: "Помещение без имени/номера",
    severity: "warning",
    applies: (record) => record.category === "IFCSPACE" && !(record.name && record.number),
    describe: () => "Помещение должно иметь Name и номер/Tag/LongName для ведомостей помещений.",
  },
  {
    type: "missing-material",
    title: "Нет материала",
    severity: "info",
    applies: (record) => isBuildingElement(record) && !hasMaterial(record),
    describe: () => "В атрибутах элемента не найден материал. Это может быть допустимо, но стоит проверить для спецификаций.",
  },
];

export function createRuleContext(records: BimElementRecord[]): RuleContext {
  const globalIdCounts = new Map<string, number>();
  let proxyCount = 0;

  for (const record of records) {
    if (record.globalId) globalIdCounts.set(record.globalId, (globalIdCounts.get(record.globalId) ?? 0) + 1);
    if (record.category === "IFCBUILDINGELEMENTPROXY") proxyCount++;
  }

  return {
    duplicateGlobalIds: new Set([...globalIdCounts.entries()].filter(([, count]) => count > 1).map(([globalId]) => globalId)),
    proxyShare: records.length ? proxyCount / records.length : 0,
  };
}

export function createIssueFromRule(record: BimElementRecord, rule: HealthRule, context: RuleContext): HealthCheckIssue {
  return {
    id: `${rule.type}:${record.modelId}:${record.localId}`,
    type: rule.type,
    title: rule.title,
    description: rule.describe(record, context),
    severity: rule.severity,
    modelId: record.modelId,
    localId: record.localId,
    globalId: record.globalId,
    record,
  };
}

function isBuildingElement(record: BimElementRecord) {
  return record.category.startsWith("IFC") && !["IFCBUILDINGSTOREY", "IFCPROJECT", "IFCSITE", "IFCBUILDING"].includes(record.category);
}

function hasMaterial(record: BimElementRecord) {
  return Boolean(record.materialName || record.searchable.includes("ifcmaterial") || record.searchable.includes("material"));
}
