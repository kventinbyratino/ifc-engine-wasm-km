import type { BimElementRecord } from "../data/element-record.ts";
import type { IfcClassOverride, IfcOverride, IfcPropertyOverride } from "../ifc-overrides/override-types.ts";
import { validateClassReplacement } from "../ifc-overrides/class-mapping.ts";

export type IfcExportFile = {
  fileName: string;
  content: string;
  createdAt: string;
  recordCount: number;
  overrideCount: number;
  propertyOverrideCount: number;
  classOverrideCount: number;
};

type StoreyEntry = {
  name: string;
  elevation: number;
  placementRef: string;
  ref: string;
  elementRefs: string[];
};

export function buildModifiedIfcExport(options: {
  records: BimElementRecord[];
  overrides: IfcOverride[];
  fileName?: string;
  createdAt?: string;
  modelName?: string;
}): IfcExportFile {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const fileName = options.fileName ?? "bim-export.ifc";
  const modelName = options.modelName ?? inferModelName(options.records, fileName);
  const propertyOverrides = options.overrides.filter(isPropertyOverride);
  const classOverrides = options.overrides.filter(isClassOverride);

  return {
    fileName,
    createdAt,
    content: buildIfcStepFile({
      records: options.records,
      createdAt,
      fileName,
      modelName,
      propertyOverrides,
      classOverrides,
    }),
    recordCount: options.records.length,
    overrideCount: options.overrides.length,
    propertyOverrideCount: propertyOverrides.length,
    classOverrideCount: classOverrides.length,
  };
}

export function downloadModifiedIfcExport(options: Parameters<typeof buildModifiedIfcExport>[0]) {
  const file = buildModifiedIfcExport(options);
  downloadFile(file.fileName, file.content, "application/ifc");
  return file;
}

function buildIfcStepFile(options: {
  records: BimElementRecord[];
  createdAt: string;
  fileName: string;
  modelName: string;
  propertyOverrides: IfcPropertyOverride[];
  classOverrides: IfcClassOverride[];
}) {
  const writer = createStepWriter();
  const createdAt = options.createdAt;
  const timestamp = createdAt.replace(/\.[0-9]+Z$/, "Z");
  const createdAtUnix = Math.max(0, Math.floor(Date.parse(createdAt) / 1000) || 0);
  const safeModelName = options.modelName.trim() || "BIM export";

  const origin = writer.add("IFCCARTESIANPOINT", "((0.,0.,0.))");
  const zAxis = writer.add("IFCDIRECTION", "((0.,0.,1.))");
  const xAxis = writer.add("IFCDIRECTION", "((1.,0.,0.))");
  const axis = writer.add("IFCAXIS2PLACEMENT3D", `(${origin},${zAxis},${xAxis})`);
  const context = writer.add("IFCGEOMETRICREPRESENTATIONCONTEXT", `('', 'Model', 3, 1.E-9, ${axis}, $)`);
  const lengthUnit = writer.add("IFCSIUNIT", "(*,.LENGTHUNIT.,.MILLI.,.METRE.)");
  const areaUnit = writer.add("IFCSIUNIT", "(*,.AREAUNIT.,$,.SQUARE_METRE.)");
  const volumeUnit = writer.add("IFCSIUNIT", "(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)");
  const angleUnit = writer.add("IFCSIUNIT", "(*,.PLANEANGLEUNIT.,$,.RADIAN.)");
  const units = writer.add("IFCUNITASSIGNMENT", `((${[lengthUnit, areaUnit, volumeUnit, angleUnit].join(",")}))`);
  const person = writer.add("IFCPERSON", "($,'Hermes',$,$,$,$,$,$)");
  const organization = writer.add("IFCORGANIZATION", "($,'Hermes',$,$,$)");
  const personAndOrg = writer.add("IFCPERSONANDORGANIZATION", `(${person},${organization},$)`);
  const applicationOrg = writer.add("IFCORGANIZATION", "($,'Hermes',$,$,$)");
  const application = writer.add("IFCAPPLICATION", `(${applicationOrg},'1.0','Hermes IFC exporter','HERMES')`);
  const ownerHistory = writer.add("IFCOWNERHISTORY", `(${personAndOrg},${application},.READWRITE.,.ADDED.,$,$,$,${createdAtUnix})`);
  const project = writer.add(
    "IFCPROJECT",
    `('HERMES-${stableIdSuffix(safeModelName)}',${ownerHistory},${quoteIfc(safeModelName)},$,$,${quoteIfc(safeModelName)},$ ,(${context}),${units})`.replace("$ ,", "$,"),
  );

  const sitePlacement = writer.add("IFCLOCALPLACEMENT", `($,${axis})`);
  const site = writer.add(
    "IFCSITE",
    `('HERMES-SITE-${stableIdSuffix(safeModelName)}',${ownerHistory},'Site',$,$,${sitePlacement},$,$,.ELEMENT.,$,$,$,$,$)`,
  );
  const buildingPlacement = writer.add("IFCLOCALPLACEMENT", `(${sitePlacement},${axis})`);
  const building = writer.add(
    "IFCBUILDING",
    `('HERMES-BUILDING-${stableIdSuffix(safeModelName)}',${ownerHistory},'Building',$,$,${buildingPlacement},$,$,.ELEMENT.,$,$,$)`,
  );

  const storeyEntries = buildStoreyEntries(options.records);
  const storeyMap = new Map<string, StoreyEntry>();
  for (const entry of storeyEntries) {
    entry.placementRef = writer.add("IFCLOCALPLACEMENT", `(${buildingPlacement},${axis})`);
    entry.ref = writer.add(
      "IFCBUILDINGSTOREY",
      `('HERMES-STOREY-${stableIdSuffix(safeModelName, entry.name)}',${ownerHistory},${quoteIfc(entry.name)},$,$,${entry.placementRef},$,$,.ELEMENT.,${formatNumber(entry.elevation)})`,
    );
    storeyMap.set(entry.name, entry);
  }
  if (storeyEntries.length === 0) {
    const defaultPlacementRef = writer.add("IFCLOCALPLACEMENT", `(${buildingPlacement},${axis})`);
    const defaultRef = writer.add(
      "IFCBUILDINGSTOREY",
      `('HERMES-STOREY-${stableIdSuffix(safeModelName, "Default Storey")}',${ownerHistory},'Default Storey',$,$,${defaultPlacementRef},$,$,.ELEMENT.,0.)`,
    );
    const defaultStorey: StoreyEntry = {
      name: "Default Storey",
      elevation: 0,
      placementRef: defaultPlacementRef,
      ref: defaultRef,
      elementRefs: [],
    };
    storeyEntries.push(defaultStorey);
    storeyMap.set(defaultStorey.name, defaultStorey);
  }

  writer.add("IFCRELAGGREGATES", `('HERMES-REL-PROJECT-${stableIdSuffix(safeModelName)}',${ownerHistory},$,$,${project},(${site}))`);
  writer.add("IFCRELAGGREGATES", `('HERMES-REL-SITE-${stableIdSuffix(safeModelName)}',${ownerHistory},$,$,${site},(${building}))`);
  writer.add("IFCRELAGGREGATES", `('HERMES-REL-BUILDING-${stableIdSuffix(safeModelName)}',${ownerHistory},$,$,${building},(${storeyEntries.map((entry) => entry.ref).join(",")}))`);

  const classOverrides = groupClassOverrides(options.classOverrides);
  const propertyGroups = groupPropertyOverrides(options.propertyOverrides, options.records);
  const materialGroups = new Map<string, { materialRef: string; elementRefs: string[] }>();

  for (const record of options.records) {
    const storey = storeyMap.get(normalizeStoreyName(record.storey)) ?? storeyEntries[0];
    const resolvedClass = resolveIfcClass(record.category, classOverrides.get(recordKey(record))?.toClass);
    const elementPlacement = writer.add("IFCLOCALPLACEMENT", `(${storey.ref},${axis})`);
    const elementRef = writer.add(resolvedClass, buildProductArgs(resolvedClass, record, elementPlacement));
    storey.elementRefs.push(elementRef);

    const materialName = normalizeMaterialName(record.materialName);
    if (materialName) {
      const existing = materialGroups.get(materialName);
      if (existing) {
        existing.elementRefs.push(elementRef);
      } else {
        materialGroups.set(materialName, {
          materialRef: writer.add("IFCMATERIAL", `(${quoteIfc(materialName)})`),
          elementRefs: [elementRef],
        });
      }
    }

    const overridesBySet = propertyGroups.get(recordKey(record));
    if (overridesBySet) {
      for (const [propertySetName, overridesForSet] of overridesBySet.entries()) {
        if (overridesForSet.length === 0) continue;
        const propertyRefs = overridesForSet.map((override) =>
          writer.add("IFCPROPERTYSINGLEVALUE", `(${quoteIfc(override.propertyName)},$,${formatIfcSelectValue(override.value)},$)`),
        );
        const propertySetRef = writer.add(
          "IFCPROPERTYSET",
          `('HERMES-PSET-${stableIdSuffix(safeModelName, recordKey(record), propertySetName)}',${ownerHistory},${quoteIfc(propertySetName)},$,(${propertyRefs.join(",")}))`,
        );
        writer.add("IFCRELDEFINESBYPROPERTIES", `('HERMES-REL-PSET-${stableIdSuffix(safeModelName, recordKey(record), propertySetName)}',${ownerHistory},$,$,(${elementRef}),${propertySetRef})`);
      }
    }
  }

  for (const { materialRef, elementRefs } of materialGroups.values()) {
    writer.add(
      "IFCRELASSOCIATESMATERIAL",
      `('HERMES-REL-MATERIAL-${stableIdSuffix(safeModelName, materialRef)}',${ownerHistory},$,$,(${elementRefs.join(",")}),${materialRef})`,
    );
  }

  for (const entry of storeyEntries) {
    if (entry.elementRefs.length === 0) continue;
    writer.add(
      "IFCRELCONTAINEDINSPATIALSTRUCTURE",
      `('HERMES-REL-CONTAINED-${stableIdSuffix(safeModelName, entry.name)}',${ownerHistory},$,$,(${entry.elementRefs.join(",")}),${entry.ref})`,
    );
  }

  return [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');",
    `FILE_NAME(${quoteIfc(options.fileName)},${quoteIfc(timestamp)},('Hermes'),('Hermes'),'Hermes IFC exporter','Hermes','');`,
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
    ...writer.lines,
    "ENDSEC;",
    "END-ISO-10303-21;",
  ].join("\n");
}

function buildStoreyEntries(records: BimElementRecord[]) {
  const order = new Map<string, number>();
  for (const record of records) {
    const name = normalizeStoreyName(record.storey);
    if (!order.has(name)) order.set(name, order.size);
  }
  return [...order.entries()].map<StoreyEntry>(([name, index]) => ({
    name,
    elevation: index * 3000,
    placementRef: "",
    ref: "",
    elementRefs: [],
  }));
}

function groupPropertyOverrides(overrides: IfcPropertyOverride[], records: BimElementRecord[]) {
  const knownRecords = new Set(records.map(recordKey));
  const groups = new Map<string, Map<string, IfcPropertyOverride[]>>();
  for (const override of overrides) {
    const key = `${override.modelId}:${override.localId}`;
    if (!knownRecords.has(key)) continue;
    const setName = override.propertySet || "Pset_HermesExport";
    const perRecord = groups.get(key) ?? new Map<string, IfcPropertyOverride[]>();
    const list = perRecord.get(setName) ?? [];
    list.push(override);
    perRecord.set(setName, list);
    groups.set(key, perRecord);
  }
  return groups;
}

function groupClassOverrides(overrides: IfcClassOverride[]) {
  const groups = new Map<string, IfcClassOverride>();
  for (const override of overrides) {
    const validation = validateClassReplacement(override.fromClass, override.toClass);
    if (!validation.ok) continue;
    groups.set(`${override.modelId}:${override.localId}`, override);
  }
  return groups;
}

function resolveIfcClass(sourceClass: string, overrideClass?: string) {
  const candidate = (overrideClass ?? sourceClass).trim().toUpperCase();
  if (candidate === "IFCWALL" || candidate === "IFCWALLSTANDARDCASE") return candidate;
  return "IFCBUILDINGELEMENTPROXY";
}

function buildProductArgs(className: string, record: BimElementRecord, placementRef: string) {
  const name = quoteIfc(record.name || record.typeName || record.category || "Element");
  const objectType = record.typeName ? quoteIfc(record.typeName) : "$";
  const tag = record.number ? quoteIfc(record.number) : "$";
  const predefinedType = className === "IFCWALL" || className === "IFCWALLSTANDARDCASE" ? ".STANDARD." : ".NOTDEFINED.";
  return `(${quoteIfc(record.globalId)},$,${name},$,${objectType},${placementRef},$,${tag},${predefinedType})`;
}

function recordKey(record: BimElementRecord) {
  return `${record.modelId}:${record.localId}`;
}

function normalizeStoreyName(storey: string) {
  return storey.trim() || "Default Storey";
}

function normalizeMaterialName(materialName: string) {
  return materialName.trim();
}

function inferModelName(records: BimElementRecord[], fileName: string) {
  return records[0]?.modelId?.trim() || fileName.replace(/\.ifc$/i, "") || "BIM export";
}

function stableIdSuffix(...parts: string[]) {
  return sanitizeFileName(parts.filter(Boolean).join("-")).slice(0, 48) || "export";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\p{L}\p{N}_.-]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "export";
}

function quoteIfc(value: string) {
  return `'${String(value ?? "").replace(/\r?\n/g, " ").replace(/'/g, "''")}'`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0.";
  const normalized = Math.round(value * 1000) / 1000;
  return Number.isInteger(normalized) ? `${normalized.toFixed(1)}` : `${normalized}`;
}

function formatIfcSelectValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "$";
  if (typeof value === "boolean") return `IFCBOOLEAN(${value ? ".T." : ".F."})`;
  if (typeof value === "number") return Number.isInteger(value) ? `IFCINTEGER(${value})` : `IFCREAL(${formatNumber(value)})`;
  return `IFCTEXT(${quoteIfc(String(value))})`;
}

function isPropertyOverride(override: IfcOverride): override is IfcPropertyOverride {
  return override.kind === "property";
}

function isClassOverride(override: IfcOverride): override is IfcClassOverride {
  return override.kind === "class";
}

function createStepWriter() {
  let nextId = 1;
  const lines: string[] = [];
  return {
    lines,
    add(type: string, args: string) {
      const ref = `#${nextId++}`;
      lines.push(`${ref}=${type}${args};`);
      return ref;
    },
  };
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
