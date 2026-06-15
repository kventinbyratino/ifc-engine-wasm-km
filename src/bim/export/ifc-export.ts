import type { BimElementRecord } from "../data/element-record.ts";
import type { IfcOverride, IfcClassOverride, IfcPropertyOverride } from "../ifc-overrides/override-types.ts";
import { validateClassReplacement } from "../ifc-overrides/class-mapping.ts";

export type ExportedIfcRecord = BimElementRecord & {
  sourceCategory?: string;
  appliedPropertyOverrides?: Array<{
    propertySet: string;
    propertyName: string;
    value: unknown;
  }>;
  rejectedClassOverride?: string;
};

export type IfcExportPackage = {
  kind: "ifc-export-package";
  version: 1;
  createdAt: string;
  sourceRecordCount: number;
  overrideCount: number;
  propertyOverrideCount: number;
  classOverrideCount: number;
  rejectedOverrideCount: number;
  records: ExportedIfcRecord[];
  overrides: IfcOverride[];
};

export function buildIfcExportPackage(records: BimElementRecord[], overrides: IfcOverride[]): IfcExportPackage {
  const transformedRecords = records.map((record) => ({ ...record } as ExportedIfcRecord));
  const propertyOverrides = overrides.filter(isPropertyOverride);
  const classOverrides = overrides.filter(isClassOverride);
  const rejected: string[] = [];

  for (const override of classOverrides) {
    const record = transformedRecords.find((item) => item.modelId === override.modelId && item.localId === override.localId);
    if (!record) continue;

    const validation = validateClassReplacement(override.fromClass, override.toClass);
    if (!validation.ok) {
      record.rejectedClassOverride = validation.reason;
      rejected.push(validation.reason);
      continue;
    }

    if (record.sourceCategory === undefined) record.sourceCategory = record.category;
    record.category = validation.toClass;
  }

  for (const override of propertyOverrides) {
    const record = transformedRecords.find((item) => item.modelId === override.modelId && item.localId === override.localId);
    if (!record) continue;
    record.appliedPropertyOverrides ??= [];
    record.appliedPropertyOverrides.push({
      propertySet: override.propertySet,
      propertyName: override.propertyName,
      value: override.value,
    });
  }

  return {
    kind: "ifc-export-package",
    version: 1,
    createdAt: new Date().toISOString(),
    sourceRecordCount: records.length,
    overrideCount: overrides.length,
    propertyOverrideCount: propertyOverrides.length,
    classOverrideCount: classOverrides.length,
    rejectedOverrideCount: rejected.length,
    records: transformedRecords,
    overrides: [...overrides],
  };
}

export function downloadIfcExportPackage(records: BimElementRecord[], overrides: IfcOverride[], fileName = "bim-export.ifc.json") {
  const packageData = buildIfcExportPackage(records, overrides);
  downloadFile(fileName, JSON.stringify(packageData, null, 2), "application/json");
  return packageData;
}

function isPropertyOverride(override: IfcOverride): override is IfcPropertyOverride {
  return override.kind === "property";
}

function isClassOverride(override: IfcOverride): override is IfcClassOverride {
  return override.kind === "class";
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
