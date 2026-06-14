import { countPropertySets } from "./property-sets";
import { attr, findMaterial, findStorey, stringifyValues, type RawItem } from "./property-extractor";
import { buildSearchableIndex } from "./search-index";
import type { BimElementRecord } from "./element-record";

export function createElementRecord(modelId: string, localId: number, item: RawItem | undefined): BimElementRecord {
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
