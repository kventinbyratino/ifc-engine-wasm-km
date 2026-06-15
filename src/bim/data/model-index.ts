import type { ModelIdMap } from "../types.ts";
import { readModelIdsWithGeometry, readModelItems } from "./model-reader.ts";
import { buildElementRelationGraph, type ElementRelationSource } from "./element-relations.ts";
import { matchesElementRecord, normalizeElementIndexQuery } from "./search-index.ts";
import type { BimElementRecord, ElementRecord } from "./element-record.ts";
import { createElementRecord } from "./element-record-factory.ts";
import type { ElementIndexFilters } from "./element-index-types.ts";
import { applyClassRemapping, type ClassMappingRule } from "../ifc-overrides/class-mapping.ts";

export type { ElementRecord, BimElementRecord, ElementIndexFilters };

export async function buildModelIndex(options: {
  fragments: { list: Map<string, unknown> };
  onProgress?: (processed: number, total: number) => void;
  signal?: AbortSignal;
  classMappings?: ClassMappingRule[];
}) {
  const records: BimElementRecord[] = [];
  const sources: ElementRelationSource[] = [];
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
        const item = chunk.items[itemIndex] as Parameters<typeof createElementRecord>[2];
        const record = createElementRecord(modelId, localId, item);
        records.push(record);
        sources.push({ record, item });
      }

      processed += chunk.ids.length;
      options.onProgress?.(processed, total);
    }
  }

  const remappedRecords = options.classMappings?.length ? applyClassRemapping(records, options.classMappings) : records;

  return {
    records: remappedRecords,
    relations: buildElementRelationGraph(sources),
  };
}

export function filterModelIndex(records: BimElementRecord[], filters: ElementIndexFilters) {
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
