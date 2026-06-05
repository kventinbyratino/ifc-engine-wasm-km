import type { BimElementRecord } from "../data/element-index";

export type FederatedModelSummary = {
  modelId: string;
  name: string;
  discipline: string;
  color: string;
  elementCount: number;
};

const DISCIPLINE_BY_CATEGORY: Array<[RegExp, string, string]> = [
  [/IFC(WALL|SLAB|COLUMN|BEAM|FOOTING|ROOF|STAIR|RAMP|BUILDINGELEMENTPROXY)/, "AR/KR", "#2563eb"],
  [/IFC(DUCT|PIPE|FLOW|CABLE|DISTRIBUTION|SANITARY|VALVE|PUMP|FAN|AIRTERMINAL)/, "MEP", "#f97316"],
  [/IFC(DOOR|WINDOW|CURTAINWALL|RAILING|FURNISHING)/, "AR", "#16a34a"],
];

export function summarizeFederatedModels(records: BimElementRecord[]): FederatedModelSummary[] {
  const byModel = new Map<string, BimElementRecord[]>();
  for (const record of records) {
    const bucket = byModel.get(record.modelId) ?? [];
    bucket.push(record);
    byModel.set(record.modelId, bucket);
  }

  return [...byModel.entries()].map(([modelId, modelRecords], index) => {
    const discipline = inferDiscipline(modelRecords);
    return {
      modelId,
      name: modelRecords[0]?.modelId || `Model ${index + 1}`,
      discipline,
      color: inferColor(discipline, index),
      elementCount: modelRecords.length,
    };
  });
}

export function getClashGroupOptions(records: BimElementRecord[]) {
  const categories = [...new Set(records.map((record) => record.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
  const storeys = [...new Set(records.map((record) => record.storey).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
  return { categories, storeys };
}

export function selectClashGroup(records: BimElementRecord[], selector: string) {
  if (!selector || selector === "all") return records;
  const [kind, value] = selector.split(":", 2);
  if (kind === "category") return records.filter((record) => record.category === value);
  if (kind === "storey") return records.filter((record) => record.storey === value);
  if (kind === "model") return records.filter((record) => record.modelId === value);
  return records;
}

function inferDiscipline(records: BimElementRecord[]) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const category = record.category.toUpperCase();
    const match = DISCIPLINE_BY_CATEGORY.find(([regex]) => regex.test(category));
    const discipline = match?.[1] ?? "BIM";
    counts.set(discipline, (counts.get(discipline) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "BIM";
}

function inferColor(discipline: string, index: number) {
  const colors: Record<string, string> = {
    "AR/KR": "#2563eb",
    AR: "#16a34a",
    MEP: "#f97316",
    BIM: "#64748b",
  };
  return colors[discipline] ?? ["#2563eb", "#16a34a", "#f97316", "#7c3aed"][index % 4];
}
