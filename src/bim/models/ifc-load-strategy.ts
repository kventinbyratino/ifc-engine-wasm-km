export type IfcLoadStrategy =
  | {
      kind: "browser";
      reason: "within-browser-limit";
    }
  | {
      kind: "backend-required";
      reason: "exceeds-browser-limit";
      maxBytes: number;
      sizeBytes: number;
      message: string;
    };

export interface ResolveIfcLoadStrategyOptions {
  sizeBytes: number;
  maxBrowserBytes: number;
}

export function resolveIfcLoadStrategy({ sizeBytes, maxBrowserBytes }: ResolveIfcLoadStrategyOptions): IfcLoadStrategy {
  if (sizeBytes <= maxBrowserBytes) {
    return { kind: "browser", reason: "within-browser-limit" };
  }

  return {
    kind: "backend-required",
    reason: "exceeds-browser-limit",
    maxBytes: maxBrowserBytes,
    sizeBytes,
    message: `IFC больше ${formatBytes(maxBrowserBytes)} — нужна серверная конвертация`,
  };
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = unitIndex === 0 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}
