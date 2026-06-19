import type { IfcOverride, IfcOverrideState } from "../ifc-overrides/override-types.ts";

export type PropertyOverrideSelection = {
  modelId: string;
  localId: number;
};

export type PendingOverrideListItem = {
  key: string;
  title: string;
  target: string;
  valueLabel: string;
  statusLabel: string;
};

export type OverrideEditorViewModel = {
  summary: string;
  selectionLabel: string;
  selectedPropertyKey: string;
  selectedStatus: string;
  canClear: boolean;
  pendingItems: PendingOverrideListItem[];
};

export function buildOverrideEditorViewModel(options: {
  selection: PropertyOverrideSelection | null;
  state: IfcOverrideState;
}): OverrideEditorViewModel {
  const { selection, state } = options;
  const selectedOverride = selection
    ? state.pendingOverrides.find((entry) => entry.kind === "property" && entry.modelId === selection.modelId && entry.localId === selection.localId)
    : undefined;

  return {
    summary: `${state.pendingCount} pending · ${state.propertyCount} property · ${state.classCount} class`,
    selectionLabel: selection ? formatOverrideTarget(selection.modelId, selection.localId) : "элемент не выбран",
    selectedPropertyKey: selectedOverride && selectedOverride.kind === "property" ? formatPropertyKey(selectedOverride) : "исходное свойство не выбрано",
    selectedStatus: selectedOverride ? "изменено" : "исходное",
    canClear: state.pendingCount > 0,
    pendingItems: state.pendingOverrides.map(toPendingOverrideListItem),
  };
}

export function toPendingOverrideListItem(override: IfcOverride): PendingOverrideListItem {
  if (override.kind === "property") {
    return {
      key: override.key,
      title: formatPropertyKey(override),
      target: formatOverrideTarget(override.modelId, override.localId),
      valueLabel: formatOverrideValue(override.value),
      statusLabel: "изменено",
    };
  }

  return {
    key: override.key,
    title: `IFC class → ${override.toClass}`,
    target: formatOverrideTarget(override.modelId, override.localId),
    valueLabel: override.reason ? `reason: ${override.reason}` : `${override.fromClass} → ${override.toClass}`,
    statusLabel: "class remap",
  };
}

export function formatOverrideValue(value: unknown): string {
  if (value === "") return "пустое значение";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatPropertyKey(override: { propertySet: string; propertyName: string }) {
  return `${override.propertySet}.${override.propertyName}`;
}

function formatOverrideTarget(modelId: string, localId: number) {
  return `${modelId} #${localId}`;
}
