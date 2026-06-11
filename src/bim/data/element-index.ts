import type { ModelIdMap } from "../types";
import { countPropertySets } from "./property-sets";
import { readModelIdsWithGeometry, readModelItems } from "./model-reader";
import { buildSearchableIndex, matchesElementRecord, normalizeElementIndexQuery } from "./search-index";
import { attr, findMaterial, findStorey, stringifyValues, type RawItem } from "./extractors";

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

export async function buildElementIndex(options: {
  fragments: { list: Map<string, unknown> };
  onProgress?: (processed: number, total: number) => void;
  signal?: AbortSignal;
}) {
  const records: BimElementRecord[] = [];
  const modelEntries = [...options.fragments.list] as Array<[string, any]>;
  const modelItems: Array<{ modelId: string; model: any; ids: number[] }> = [];
  let total = 0;

  for (const [modelId, model] of modelEntries) {
    const ids = await readModelIdsWithGeometry(model, options.signal);
    total += ids.length;
    modelItems.push({ modelId, model, ids });
  }

  let processed = 0;
  const queryOptions = {
    attributesDefault: true,
    relationsDefault: { attributes: true, relations: false },
    relations: {
      IsDefinedBy: { attributes: true, relations: false },
      DefinesOccurrence: { attributes: true, relations: false },
      ContainedInStructure: { attributes: true, relations: false },
    },
  };

  for (const { modelId, model, ids } of modelItems) {
    const chunks = await readModelItems(model, ids, queryOptions, options.signal, 500);
    for (const chunk of chunks) {
      for (let itemIndex = 0; itemIndex < chunk.ids.length; itemIndex++) {
        const localId = chunk.ids[itemIndex];
        const item = chunk.items[itemIndex] as RawItem | undefined;
        records.push(createElementRecord(modelId, localId, item));
      }

      processed += chunk.ids.length;
      options.onProgress?.(processed, total);
    }
  }

  return records;
}

export function filterElementIndex(records: BimElementRecord[], filters: ElementIndexFilters) {
  const normalized = normalizeElementIndexQuery(filters);
  return records.filter((record) => matchesElementRecord(record, normalized));
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
  const searchable = buildSearchableIndex([
    modelId,
    localId,
    name,
    category,
    globalId,
    typeName,
    storey,
    number,
    materialName,
    stringifyValues(item),
  ]);

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
