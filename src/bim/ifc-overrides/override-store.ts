import {
  createEmptyIfcOverrideState,
  type IfcClassOverride,
  type IfcClassOverrideDraft,
  type IfcOverride,
  type IfcOverrideClock,
  type IfcOverrideState,
  type IfcPropertyOverride,
  type IfcPropertyOverrideDraft,
} from "./override-types.ts";

export type IfcOverrideStore = {
  list: () => IfcOverride[];
  snapshot: () => IfcOverrideState;
  setPropertyOverride: (draft: IfcPropertyOverrideDraft) => IfcPropertyOverride;
  setClassOverride: (draft: IfcClassOverrideDraft) => IfcClassOverride;
  remove: (key: string) => boolean;
  clear: () => void;
};

export function createOverrideKey(
  draft:
    | ({ kind: "property" } & IfcPropertyOverrideDraft)
    | ({ kind: "class" } & IfcClassOverrideDraft),
) {
  if (draft.kind === "property") {
    return ["property", normalizeToken(draft.modelId), draft.localId, normalizeToken(draft.propertySet), normalizeToken(draft.propertyName)].join(":");
  }

  return ["class", normalizeToken(draft.modelId), draft.localId].join(":");
}

export function createIfcOverrideStore(options: { now?: IfcOverrideClock } = {}): IfcOverrideStore {
  const now = options.now ?? (() => new Date().toISOString());
  let overrides: IfcOverride[] = [];

  return {
    list: () => [...overrides],
    snapshot: () => summarizeOverrides(overrides),
    setPropertyOverride: (draft) => {
      const override = buildPropertyOverride(draft, now);
      upsertOverride(overrides, override);
      return override;
    },
    setClassOverride: (draft) => {
      const override = buildClassOverride(draft, now);
      upsertOverride(overrides, override);
      return override;
    },
    remove: (key) => {
      const before = overrides.length;
      overrides = overrides.filter((entry) => entry.key !== key);
      return overrides.length !== before;
    },
    clear: () => {
      overrides = [];
    },
  };

  function upsertOverride(current: IfcOverride[], next: IfcOverride) {
    const index = current.findIndex((entry) => entry.key === next.key);
    if (index === -1) {
      overrides = [...current, next];
      return next;
    }

    const previous = current[index];
    if (previous.kind === "property" && next.kind === "property") {
      overrides = [...current.slice(0, index), { ...previous, ...next, key: previous.key, createdAt: previous.createdAt }, ...current.slice(index + 1)];
      return next;
    }

    if (previous.kind === "class" && next.kind === "class") {
      overrides = [...current.slice(0, index), { ...previous, ...next, key: previous.key, createdAt: previous.createdAt }, ...current.slice(index + 1)];
      return next;
    }

    overrides = [...current.slice(0, index), next, ...current.slice(index + 1)];
    return next;
  }
}

function buildPropertyOverride(draft: IfcPropertyOverrideDraft, now: IfcOverrideClock): IfcPropertyOverride {
  const createdAt = now();
  const normalized = normalizePropertyDraft(draft);
  return {
    ...normalized,
    kind: "property",
    key: createOverrideKey({ kind: "property", ...normalized }),
    status: "pending",
    createdAt,
    updatedAt: createdAt,
  };
}

function buildClassOverride(draft: IfcClassOverrideDraft, now: IfcOverrideClock): IfcClassOverride {
  const createdAt = now();
  const normalized = normalizeClassDraft(draft);
  return {
    ...normalized,
    kind: "class",
    key: createOverrideKey({ kind: "class", ...normalized }),
    status: "pending",
    createdAt,
    updatedAt: createdAt,
  };
}

function summarizeOverrides(overrides: IfcOverride[]): IfcOverrideState {
  return {
    ...createEmptyIfcOverrideState(),
    pendingOverrides: [...overrides],
    pendingCount: overrides.length,
    propertyCount: overrides.filter((entry) => entry.kind === "property").length,
    classCount: overrides.filter((entry) => entry.kind === "class").length,
    lastUpdatedAt: overrides.at(-1)?.updatedAt ?? "",
  };
}

function normalizePropertyDraft(draft: IfcPropertyOverrideDraft): IfcPropertyOverrideDraft {
  return {
    modelId: normalizeToken(draft.modelId),
    localId: Number.isFinite(draft.localId) ? Math.floor(draft.localId) : 0,
    propertySet: normalizeToken(draft.propertySet),
    propertyName: normalizeToken(draft.propertyName),
    value: draft.value,
  };
}

function normalizeClassDraft(draft: IfcClassOverrideDraft): IfcClassOverrideDraft {
  return {
    modelId: normalizeToken(draft.modelId),
    localId: Number.isFinite(draft.localId) ? Math.floor(draft.localId) : 0,
    fromClass: normalizeToken(draft.fromClass),
    toClass: normalizeToken(draft.toClass),
    reason: normalizeOptionalToken(draft.reason),
  };
}

function normalizeToken(value: string) {
  return String(value ?? "").trim().replace(/\s+/g, "-") || "unknown";
}

function normalizeOptionalToken(value: string | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : undefined;
}
