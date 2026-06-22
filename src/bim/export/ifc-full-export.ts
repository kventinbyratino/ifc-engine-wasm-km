import {
  Handle,
  IFCPROPERTYSET,
  IFCPROPERTYSINGLEVALUE,
  IFCRELDEFINESBYPROPERTIES,
  IfcAPI,
} from "web-ifc";
import type { BimElementRecord } from "../data/element-record.ts";
import type { IfcClassOverride, IfcOverride, IfcPropertyOverride } from "../ifc-overrides/override-types.ts";
import { validateClassReplacement } from "../ifc-overrides/class-mapping.ts";
import { WEB_IFC_BASE } from "../config.ts";

export type SourceIfcModel = {
  modelId: string;
  fileName: string;
  buffer?: ArrayBuffer;
  downloadUrl?: string;
};

export type FullIfcExportFile = {
  fileName: string;
  bytes: Uint8Array;
  createdAt: string;
  modelId: string;
  sourceFileName: string;
  recordCount: number;
  overrideCount: number;
  propertyOverrideCount: number;
  classOverrideCount: number;
  appliedPropertyOverrideCount: number;
  appliedClassOverrideCount: number;
  skippedOverrideCount: number;
};

export async function buildFullModifiedIfcExport(options: {
  records: BimElementRecord[];
  overrides: IfcOverride[];
  sources: Record<string, SourceIfcModel | undefined>;
  fileName?: string;
  createdAt?: string;
  wasmPath?: string;
}): Promise<FullIfcExportFile> {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const records = options.records;
  const modelIds = [...new Set(records.map((record) => record.modelId))];
  if (modelIds.length === 0) throw new Error("Нет элементов для IFC export.");
  if (modelIds.length > 1) throw new Error("Полноценный IFC export пока поддерживает одну исходную IFC-модель за раз.");

  const modelId = modelIds[0];
  const source = options.sources[modelId];
  if (!source) throw new Error("Для этой модели нет исходного IFC-файла. Полноценный export доступен только для загруженного IFC, не для FRAG/fixture без source IFC.");

  const propertyOverrides = options.overrides.filter(isPropertyOverride);
  const classOverrides = options.overrides.filter(isClassOverride);
  const selectedKeys = new Set(records.map(recordKey));
  const ifc = new IfcAPI();
  ifc.SetWasmPath(options.wasmPath ?? defaultWasmPath(), true);
  await ifc.Init();

  const sourceBytes = await resolveSourceBytes(source);
  const openedModelId = ifc.OpenModel(sourceBytes);
  let nextExpressId = ifc.GetMaxExpressID(openedModelId) + 1;
  let appliedPropertyOverrideCount = 0;

  try {
    for (const override of propertyOverrides) {
      if (!selectedKeys.has(overrideKey(override))) continue;
      const targetLine = ifc.GetLine(openedModelId, override.localId, false, false);
      if (!targetLine) continue;

      const propertyId = nextExpressId++;
      const propertySetId = nextExpressId++;
      const relationId = nextExpressId++;
      const ownerHistory = targetLine.OwnerHistory ?? null;
      const propertySetName = override.propertySet || "Pset_HermesExport";

      ifc.WriteLine(openedModelId, {
        expressID: propertyId,
        type: IFCPROPERTYSINGLEVALUE,
        Name: ifcString(override.propertyName, "IFCIDENTIFIER"),
        Description: null,
        NominalValue: ifcSelectValue(override.value),
        Unit: null,
      });
      ifc.WriteLine(openedModelId, {
        expressID: propertySetId,
        type: IFCPROPERTYSET,
        GlobalId: ifcString(stableExportGlobalId("PSET", modelId, override.localId, propertySetName, override.propertyName), "IFCGLOBALLYUNIQUEID"),
        OwnerHistory: ownerHistory,
        Name: ifcString(propertySetName, "IFCLABEL"),
        Description: null,
        HasProperties: [new Handle(propertyId)],
      });
      ifc.WriteLine(openedModelId, {
        expressID: relationId,
        type: IFCRELDEFINESBYPROPERTIES,
        GlobalId: ifcString(stableExportGlobalId("REL-PSET", modelId, override.localId, propertySetName, override.propertyName), "IFCGLOBALLYUNIQUEID"),
        OwnerHistory: ownerHistory,
        Name: null,
        Description: null,
        RelatedObjects: [new Handle(override.localId)],
        RelatingPropertyDefinition: new Handle(propertySetId),
      });
      appliedPropertyOverrideCount += 1;
    }

    let text = new TextDecoder().decode(ifc.SaveModel(openedModelId));
    const classResult = applyClassOverridesToStepText(text, classOverrides, selectedKeys);
    text = classResult.content;
    const bytes = new TextEncoder().encode(text);

    return {
      fileName: options.fileName ?? makeExportFileName(source.fileName),
      bytes,
      createdAt,
      modelId,
      sourceFileName: source.fileName,
      recordCount: records.length,
      overrideCount: options.overrides.length,
      propertyOverrideCount: propertyOverrides.length,
      classOverrideCount: classOverrides.length,
      appliedPropertyOverrideCount,
      appliedClassOverrideCount: classResult.appliedCount,
      skippedOverrideCount: options.overrides.length - appliedPropertyOverrideCount - classResult.appliedCount,
    };
  } finally {
    ifc.CloseModel(openedModelId);
  }
}

export async function downloadFullModifiedIfcExport(options: Parameters<typeof buildFullModifiedIfcExport>[0]) {
  const file = await buildFullModifiedIfcExport(options);
  downloadBytes(file.fileName, file.bytes, "application/ifc");
  return file;
}

function applyClassOverridesToStepText(content: string, overrides: IfcClassOverride[], selectedKeys: Set<string>) {
  let result = content;
  let appliedCount = 0;
  for (const override of overrides) {
    if (!selectedKeys.has(overrideKey(override))) continue;
    const validation = validateClassReplacement(override.fromClass, override.toClass);
    if (!validation.ok) continue;

    const target = validation.toClass.toUpperCase();
    const pattern = new RegExp(`(#${override.localId}=)([A-Z0-9_]+)(\\()`, "m");
    const next = result.replace(pattern, (_match, prefix: string, _sourceClass: string, suffix: string) => `${prefix}${target}${suffix}`);
    if (next !== result) {
      result = next;
      appliedCount += 1;
    }
  }
  return { content: result, appliedCount };
}

function ifcString(value: string, name: string) {
  return {
    value: String(value ?? ""),
    type: 1,
    name,
  };
}

function ifcSelectValue(value: unknown) {
  return {
    value: String(value ?? ""),
    type: 1,
    name: "IFCTEXT",
  };
}

function makeExportFileName(sourceName: string) {
  const base = sourceName.replace(/\.ifc$/i, "") || "model";
  return `${base}-modified.ifc`;
}

function stableExportGlobalId(...parts: Array<string | number>) {
  return `HERMES-${parts.join("-")}`.replace(/[^\p{L}\p{N}_.-]+/gu, "_").slice(0, 64);
}

function recordKey(record: BimElementRecord) {
  return `${record.modelId}:${record.localId}`;
}

function overrideKey(override: IfcOverride) {
  return `${override.modelId}:${override.localId}`;
}

function isPropertyOverride(override: IfcOverride): override is IfcPropertyOverride {
  return override.kind === "property";
}

function isClassOverride(override: IfcOverride): override is IfcClassOverride {
  return override.kind === "class";
}

function downloadBytes(name: string, bytes: Uint8Array, type: string) {
  const blobPart = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([blobPart], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function resolveSourceBytes(source: SourceIfcModel) {
  if (source.buffer) {
    return new Uint8Array(source.buffer.slice(0));
  }
  if (!source.downloadUrl) {
    throw new Error("Для IFC export нет исходного буфера или URL скачивания.");
  }
  const response = await fetch(source.downloadUrl);
  if (!response.ok) {
    throw new Error(`Не удалось скачать исходный IFC: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function defaultWasmPath() {
  if (typeof window === "undefined") return "./public/web-ifc/";
  return WEB_IFC_BASE;
}
