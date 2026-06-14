export type ElementRelationType = "hosted_by" | "fills_opening" | "bounded_by" | "contains" | "adjacent_to";

export type ElementRelationEndpoint = {
  modelId: string;
  localId: number;
  globalId?: string;
  category?: string;
  name?: string;
  storey?: string;
};

export type ElementRelationEdge = {
  id: string;
  type: ElementRelationType;
  sourceField: string;
  from: ElementRelationEndpoint;
  to: ElementRelationEndpoint;
};

export type ElementRelationGraph = {
  edges: ElementRelationEdge[];
  outgoing: Record<string, ElementRelationEdge[]>;
  incoming: Record<string, ElementRelationEdge[]>;
};
