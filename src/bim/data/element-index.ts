import type { ModelIdMap } from "../types";

export type BimElementRecord = {
  modelId: string;
  localId: number;
  name: string;
  category: string;
  globalId: string;
  typeName: string;
  storey: string;
  number: string;
  materialName: string;
  psetCount: number;
  searchable: string;
};

export type ElementIndexFilters = {
  query: string;
  category: string;
  storey: string;
};

type RawItem = Record<string, unknown>;

export async function buildElementIndex(options: {
  fragments: { list: Map<string, unknown> };
  onProgress?: (processed: number, total: number) => void;
}) {
  const records: BimElementRecord[] = [];
  const modelEntries = [...options.fragments.list] as Array<[string, any]>;
  const modelItems: Array<{ modelId: string; model: any; ids: number[] }> = [];
  let total = 0;

  for (const [modelId, model] of modelEntries) {
    const ids = [...(await model.getItemsIdsWithGeometry())] as number[];
    total += ids.length;
    modelItems.push({ modelId, model, ids });
  }

  let processed = 0;
  const chunkSize = 500;

  for (const { modelId, model, ids } of modelItems) {
    for (let index = 0; index < ids.length; index += chunkSize) {
      const chunk = ids.slice(index, index + chunkSize);
      const items = await model.getItemsData(chunk, {
        attributesDefault: true,
        relationsDefault: { attributes: true, relations: false },
        relations: {
          IsDefinedBy: { attributes: true, relations: false },
          DefinesOccurrence: { attributes: true, relations: false },
          ContainedInStructure: { attributes: true, relations: false },
        },
      });

      for (let itemIndex = 0; itemIndex < chunk.length; itemIndex++) {
        const localId = chunk[itemIndex];
        const item = items[itemIndex] as RawItem | undefined;
        records.push(createElementRecord(modelId, localId, item));
      }

      processed += chunk.length;
      options.onProgress?.(processed, total);
    }
  }

  return records;
}

export function filterElementIndex(records: BimElementRecord[], filters: ElementIndexFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  const category = filters.category.trim();
  const storey = filters.storey.trim();

  return records.filter((record) => {
    if (category && record.category !== category) return false;
    if (storey && record.storey !== storey) return false;
    if (query && !record.searchable.includes(query)) return false;
    return true;
  });
}

export function recordsToModelIdMap(records: BimElementRecord[]): ModelIdMap {
  const modelIdMap: ModelIdMap = {};
  for (const record of records) {
    modelIdMap[record.modelId] ??= new Set<number>();
    modelIdMap[record.modelId].add(record.localId);
  }
  return modelIdMap;
}

export function getUniqueValues(records: BimElementRecord[], key: "category" | "storey") {
  return [...new Set(records.map((record) => record[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
}

function createElementRecord(modelId: string, localId: number, item: RawItem | undefined): BimElementRecord {
  const name = attr(item, "Name") || `#${localId}`;
  const category = attr(item, "_category") || attr(item, "ObjectType") || "IfcElement";
  const globalId = attr(item, "_guid") || attr(item, "GlobalId");
  const typeName = attr(item, "ObjectType") || attr(item, "PredefinedType") || attr(item, "Tag");
  const storey = findStorey(item);
  const number = attr(item, "Tag") || attr(item, "LongName") || attr(item, "Number");
  const materialName = findMaterial(item);
  const psetCount = countPropertySets(item);
  const searchable = [modelId, localId, name, category, globalId, typeName, storey, number, materialName, stringifyValues(item)]
    .join(" ")
    .toLocaleLowerCase();

  return {
    modelId,
    localId,
    name,
    category,
    globalId,
    typeName,
    storey,
    number,
    materialName,
    psetCount,
    searchable,
  };
}

function attr(item: RawItem | undefined, key: string) {
  const value = item?.[key];
  if (value === undefined || value === null) return "";
  if (typeof value === "object" && "value" in value) {
    const nested = (value as { value?: unknown }).value;
    return nested === undefined || nested === null ? "" : String(nested);
  }
  return String(value);
}

function findStorey(item: RawItem | undefined) {
  if (!item) return "";
  const direct = attr(item, "Storey") || attr(item, "Building Storey") || attr(item, "Level");
  if (direct) return direct;
  if (attr(item, "_category") === "IFCBUILDINGSTOREY") return attr(item, "Name");

  const seen = new WeakSet<object>();
  const visit = (value: unknown): string => {
    if (!value || typeof value !== "object" || seen.has(value)) return "";
    seen.add(value);

    if (Array.isArray(value)) {
      for (const entry of value) {
        const result = visit(entry);
        if (result) return result;
      }
      return "";
    }

    const record = value as RawItem;
    if (attr(record, "_category") === "IFCBUILDINGSTOREY") return attr(record, "Name");
    for (const nested of Object.values(record)) {
      const result = visit(nested);
      if (result) return result;
    }
    return "";
  };

  return visit(item);
}

function findMaterial(item: RawItem | undefined) {
  if (!item) return "";
  return attr(item, "Material") || attr(item, "MaterialName") || attr(item, "RelatingMaterial") || "";
}

function countPropertySets(item: RawItem | undefined) {
  if (!item) return 0;
  const names = new Set<string>();
  const seen = new WeakSet<object>();

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    const record = value as RawItem;
    const name = attr(record, "Name");
    const category = attr(record, "_category");
    if (name.startsWith("Pset_") || name.startsWith("Qto_") || category === "IFCPROPERTYSET") {
      names.add(name || JSON.stringify(record).slice(0, 80));
    }

    for (const nested of Object.values(record)) {
      if (Array.isArray(nested)) nested.forEach(visit);
      else visit(nested);
    }
  };

  visit(item);
  return names.size;
}

function stringifyValues(value: unknown) {
  const chunks: string[] = [];
  const seen = new WeakSet<object>();

  const visit = (entry: unknown) => {
    if (entry === null || entry === undefined) return;
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      chunks.push(String(entry));
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (typeof entry !== "object" || seen.has(entry)) return;
    seen.add(entry);
    Object.entries(entry as RawItem).forEach(([key, nested]) => {
      chunks.push(key);
      visit(nested);
    });
  };

  visit(value);
  return chunks.join(" ");
}
