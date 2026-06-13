import type { HealthRuleDefinition } from "./rule-registry";
import { hasMaterial, isBuildingElement } from "./rule-utils";

export const STRUCTURE_RULES: HealthRuleDefinition[] = [
  {
    type: "missing-storey",
    title: "Нет этажа",
    severity: "warning",
    group: "structure",
    priority: 300,
    applies: (record) => isBuildingElement(record) && !record.storey,
    describe: () => "Элемент не связан с этажом/Building Storey. Фильтры по этажам и планы будут неполными.",
  },
  {
    type: "missing-type",
    title: "Нет типа",
    severity: "warning",
    group: "structure",
    priority: 310,
    applies: (record) => isBuildingElement(record) && !record.typeName,
    describe: () => "Не найден ObjectType/PredefinedType/Tag. Для BIM manager это снижает качество фильтрации и ведомостей.",
  },
  {
    type: "empty-property-sets",
    title: "Пустые psets",
    severity: "warning",
    group: "structure",
    priority: 320,
    applies: (record) => isBuildingElement(record) && record.psetCount === 0,
    describe: () => "У элемента не найдено property sets. Проверки, спецификации и AI-аудит будут ограничены.",
  },
  {
    type: "missing-material",
    title: "Нет материала",
    severity: "info",
    group: "structure",
    priority: 330,
    applies: (record) => isBuildingElement(record) && !hasMaterial(record),
    describe: () => "В атрибутах элемента не найден материал. Это может быть допустимо, но стоит проверить для спецификаций.",
  },
];
