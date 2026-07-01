import { formatBytes } from "../ui/dom-utils.ts";

export type ModelLoadReportDraft = {
  sourceName: string;
  ifcSizeBytes: number;
  conversionTimeMs: number;
  sourceKind: "ifc";
  sourceOrigin: string;
  fragmentSizeBytes?: number;
};

export type ModelLoadReport = {
  sourceName: string;
  ifcSizeBytes: number;
  fragmentSizeBytes: number;
  conversionTimeMs: number;
  sceneBuildTimeMs: number;
  compressionRatio: number;
};

export type ModelLoadReportRow = {
  label: string;
  value: string;
};

export function createModelLoadReport(input: {
  sourceName: string;
  ifcSizeBytes: number;
  fragmentSizeBytes: number;
  conversionTimeMs: number;
  sceneBuildTimeMs: number;
}): ModelLoadReport {
  const ifcSizeBytes = normalizeBytes(input.ifcSizeBytes);
  const fragmentSizeBytes = Math.max(1, normalizeBytes(input.fragmentSizeBytes));
  return {
    sourceName: input.sourceName.trim() || "model",
    ifcSizeBytes,
    fragmentSizeBytes,
    conversionTimeMs: Math.max(0, input.conversionTimeMs),
    sceneBuildTimeMs: Math.max(0, input.sceneBuildTimeMs),
    compressionRatio: ifcSizeBytes / fragmentSizeBytes,
  };
}

export function buildModelLoadReportRows(report: ModelLoadReport): ModelLoadReportRow[] {
  return [
    { label: "Размер IFC", value: formatBytes(report.ifcSizeBytes) },
    { label: "Размер fragment", value: formatBytes(report.fragmentSizeBytes) },
    { label: "Время конвертации", value: formatDuration(report.conversionTimeMs) },
    { label: "Время построения сцены", value: formatDuration(report.sceneBuildTimeMs) },
    { label: "Степень сжатия", value: formatCompressionPercent(report.compressionRatio) },
  ];
}

export function formatDuration(ms: number) {
  const value = Math.max(0, ms);
  if (!Number.isFinite(value)) return "0 мс";
  if (value < 1000) return `${Math.round(value)} мс`;
  const seconds = value / 1000;
  return `${seconds.toFixed(seconds < 10 ? 2 : 1)} с`;
}

export function formatCompressionPercent(ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return "0%";
  const percent = (1 - 1 / ratio) * 100;
  return `${percent.toFixed(1)}%`;
}

function normalizeBytes(value: number) {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}
