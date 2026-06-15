export type IfcOverrideKind = "property" | "class";

export type IfcOverrideStatus = "pending" | "applied" | "discarded";

export type IfcOverrideClock = () => string;

export type IfcPropertyOverrideDraft = {
  modelId: string;
  localId: number;
  propertySet: string;
  propertyName: string;
  value: unknown;
};

export type IfcClassOverrideDraft = {
  modelId: string;
  localId: number;
  fromClass: string;
  toClass: string;
  reason?: string;
};

export type IfcPropertyOverride = IfcPropertyOverrideDraft & {
  kind: "property";
  key: string;
  status: IfcOverrideStatus;
  createdAt: string;
  updatedAt: string;
};

export type IfcClassOverride = IfcClassOverrideDraft & {
  kind: "class";
  key: string;
  status: IfcOverrideStatus;
  createdAt: string;
  updatedAt: string;
};

export type IfcOverride = IfcPropertyOverride | IfcClassOverride;

export type IfcOverrideState = {
  pendingOverrides: IfcOverride[];
  pendingCount: number;
  propertyCount: number;
  classCount: number;
  lastUpdatedAt: string;
};

export function createEmptyIfcOverrideState(): IfcOverrideState {
  return {
    pendingOverrides: [],
    pendingCount: 0,
    propertyCount: 0,
    classCount: 0,
    lastUpdatedAt: "",
  };
}
