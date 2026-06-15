import type { HealthRuleDefinition } from "./rule-registry.ts";

export const MATERIAL_RULES: HealthRuleDefinition[] = [
  {
    type: "door-missing-fire-rating",
    title: "Дверь без FireRating",
    severity: "critical",
    group: "material",
    priority: 400,
    applies: (record) => record.category === "IFCDOOR" && !record.searchable.includes("firerating"),
    describe: () => "Дверь не содержит FireRating/Pset_DoorCommon.FireRating в извлечённых атрибутах.",
  },
];
