import type { BimElementRecord } from "./element-record.ts";
import type { IfcOverride } from "../ifc-overrides/override-types.ts";
import { buildIfcExportPackage as buildIfcExportDocument, downloadIfcExportPackage } from "../export/ifc-export.ts";
import { buildFullModifiedIfcExport, downloadFullModifiedIfcExport, type SourceIfcModel } from "../export/ifc-full-export.ts";
import { buildModifiedIfcExport, downloadModifiedIfcExport } from "../export/ifc-writer.ts";

export function exportElementsJson(records: BimElementRecord[]) {
  downloadFile(
    "bim-elements.json",
    JSON.stringify(records.map(stripSearchable), null, 2),
    "application/json",
  );
}

export function exportElementsCsv(records: BimElementRecord[]) {
  const headers = ["modelId", "localId", "ifcClass", "name", "globalId", "type", "storey", "psetCount"];
  const rows = records.map((record) => [
    record.modelId,
    record.localId,
    record.category,
    record.name,
    record.globalId,
    record.typeName,
    record.storey,
    record.psetCount,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  downloadFile("bim-elements.csv", csv, "text/csv;charset=utf-8");
}

export function fillSelectOptions(select: HTMLSelectElement, values: string[], label: string) {
  const currentValue = select.value;
  select.replaceChildren(new Option(label, ""), ...values.map((value) => new Option(value, value)));
  if (values.includes(currentValue)) select.value = currentValue;
}

export function exportIfcExportPackage(records: BimElementRecord[], overrides: IfcOverride[]) {
  return downloadIfcExportPackage(records, overrides);
}

export function buildIfcExportPackage(records: BimElementRecord[], overrides: IfcOverride[]) {
  return buildIfcExportDocument(records, overrides);
}

export function exportIfcFile(records: BimElementRecord[], overrides: IfcOverride[], sources?: Record<string, SourceIfcModel>, fileName?: string) {
  if (sources) return downloadFullModifiedIfcExport({ records, overrides, sources, fileName });
  return downloadModifiedIfcExport({ records, overrides, fileName });
}

export function buildIfcFileExport(records: BimElementRecord[], overrides: IfcOverride[], fileName?: string, sources?: Record<string, SourceIfcModel>) {
  if (sources) return buildFullModifiedIfcExport({ records, overrides, sources, fileName });
  return buildModifiedIfcExport({ records, overrides, fileName });
}

function stripSearchable(record: BimElementRecord) {
  const { searchable: _searchable, ...publicRecord } = record;
  return publicRecord;
}

function escapeCsvCell(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
