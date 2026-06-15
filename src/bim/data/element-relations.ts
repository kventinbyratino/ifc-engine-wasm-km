import type { BimElementRecord } from "./element-record.ts";
import { attr, type RawItem } from "./property-extractor.ts";
import type { ElementRelationEdge, ElementRelationEndpoint, ElementRelationGraph, ElementRelationType } from "./relation-types.ts";

const RELATION_FIELD_TYPES: Record<string, ElementRelationType> = {
  ContainedInStructure: "hosted_by",
  ContainsElements: "contains",
  HasOpenings: "contains",
  FillsVoids: "fills_opening",
  BoundedBy: "bounded_by",
  Decomposes: "contains",
  IsDecomposedBy: "contains",
  AdjacentElements: "adjacent_to",
};

export type ElementRelationSource = {
  record: BimElementRecord;
  item: RawItem | undefined;
};

export function createEmptyElementRelationGraph(): ElementRelationGraph {
  return { edges: [], outgoing: {}, incoming: {} };
}

export function buildElementRelationGraph(sources: ElementRelationSource[]) {
  const graph = createEmptyElementRelationGraph();
  const lookup = buildRecordLookup(sources);

  for (const source of sources) {
    if (!source.item) continue;
    for (const relation of collectRelationCandidates(source.item)) {
      for (const target of resolveRelationTargets(source.record, relation.value, lookup)) {
        if (isSameEndpoint(source.record, target)) continue;
        addElementRelation(graph, {
          id: makeRelationId(source.record, target, relation.field, relation.type),
          type: relation.type,
          sourceField: relation.field,
          from: toRelationEndpoint(source.record),
          to: target,
        });
      }
    }
  }

  return graph;
}

export function addElementRelation(graph: ElementRelationGraph, edge: ElementRelationEdge) {
  if (graph.edges.some((existing) => existing.id === edge.id)) return graph;
  graph.edges.push(edge);
  const fromKey = makeEndpointKey(edge.from);
  const toKey = makeEndpointKey(edge.to);
  graph.outgoing[fromKey] ??= [];
  graph.incoming[toKey] ??= [];
  graph.outgoing[fromKey].push(edge);
  graph.incoming[toKey].push(edge);
  return graph;
}

export function getElementRelationCount(graph: ElementRelationGraph) {
  return graph.edges.length;
}

export function getOutgoingElementRelations(graph: ElementRelationGraph, endpoint: ElementRelationEndpoint, type?: ElementRelationType) {
  const relations = graph.outgoing[makeEndpointKey(endpoint)] ?? [];
  return type ? relations.filter((relation) => relation.type === type) : relations;
}

export function getIncomingElementRelations(graph: ElementRelationGraph, endpoint: ElementRelationEndpoint, type?: ElementRelationType) {
  const relations = graph.incoming[makeEndpointKey(endpoint)] ?? [];
  return type ? relations.filter((relation) => relation.type === type) : relations;
}

function buildRecordLookup(sources: ElementRelationSource[]) {
  const byModelLocal = new Map<string, ElementRelationEndpoint>();
  const byGlobalId = new Map<string, ElementRelationEndpoint>();

  for (const { record } of sources) {
    const endpoint = toRelationEndpoint(record);
    byModelLocal.set(makeEndpointKey(endpoint), endpoint);
    if (endpoint.globalId) byGlobalId.set(endpoint.globalId, endpoint);
  }

  return { byModelLocal, byGlobalId };
}

type RelationCandidate = { field: string; type: ElementRelationType; value: unknown };

type ResolvedReference = {
  modelId: string;
  localId: number;
  globalId?: string;
  category?: string;
  name?: string;
  storey?: string;
};

function collectRelationCandidates(item: RawItem) {
  const candidates: RelationCandidate[] = [];
  const seen = new WeakSet<object>();

  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }

    const record = value as RawItem;
    for (const [field, nested] of Object.entries(record)) {
      const type = RELATION_FIELD_TYPES[field];
      if (type) candidates.push({ field, type, value: nested });
      visit(nested);
    }
  };

  visit(item);
  return candidates;
}

function resolveRelationTargets(source: BimElementRecord, value: unknown, lookup: ReturnType<typeof buildRecordLookup>) {
  const targets: ElementRelationEndpoint[] = [];
  const seen = new WeakSet<object>();
  const resolved = new Set<string>();

  const visit = (entry: unknown) => {
    if (!entry || typeof entry !== "object" || seen.has(entry)) return;
    seen.add(entry);

    if (Array.isArray(entry)) {
      for (const nested of entry) visit(nested);
      return;
    }

    const candidate = entry as RawItem;
    const endpoint = resolveReferenceCandidate(source.modelId, candidate, lookup);
    if (endpoint) {
      const key = makeEndpointKey(endpoint);
      if (!resolved.has(key)) {
        resolved.add(key);
        targets.push(endpoint);
      }
    }

    for (const nested of Object.values(candidate)) visit(nested);
  };

  visit(value);
  return targets;
}

function resolveReferenceCandidate(sourceModelId: string, candidate: RawItem, lookup: ReturnType<typeof buildRecordLookup>) {
  const globalId = normalizeString(attr(candidate, "GlobalId") || attr(candidate, "globalId"));
  if (globalId && lookup.byGlobalId.has(globalId)) return lookup.byGlobalId.get(globalId) ?? null;

  const modelId = normalizeString(attr(candidate, "modelId") || attr(candidate, "ModelId")) || sourceModelId;
  const localId = normalizeNumber(attr(candidate, "localId") || attr(candidate, "LocalId") || attr(candidate, "ExpressId") || attr(candidate, "expressId") || attr(candidate, "id") || attr(candidate, "Id"));
  if (Number.isFinite(localId)) {
    return lookup.byModelLocal.get(makeEndpointKey({ modelId, localId })) ?? null;
  }

  return null;
}

function makeRelationId(record: BimElementRecord, target: ElementRelationEndpoint, field: string, type: ElementRelationType) {
  return `${record.modelId}:${record.localId}|${field}|${type}|${target.modelId}:${target.localId}`;
}

function toRelationEndpoint(record: BimElementRecord): ElementRelationEndpoint {
  return {
    modelId: record.modelId,
    localId: record.localId,
    globalId: record.globalId || undefined,
    category: record.category || undefined,
    name: record.name || undefined,
    storey: record.storey || undefined,
  };
}

function makeEndpointKey(endpoint: Pick<ElementRelationEndpoint, "modelId" | "localId">) {
  return `${endpoint.modelId}:${endpoint.localId}`;
}

function isSameEndpoint(record: BimElementRecord, endpoint: ElementRelationEndpoint) {
  return record.modelId === endpoint.modelId && record.localId === endpoint.localId;
}

function normalizeString(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

function normalizeNumber(value: string) {
  if (!value.trim()) return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
